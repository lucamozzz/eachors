import { JsonRpcProvider, Wallet, Contract } from 'ethers';
import express from 'express';
import cors from 'cors';
import xml2js from 'xml2js';
import fs from 'fs/promises';
import bodyParser from 'body-parser';
import { compileContract } from './deploy.js';
import { updatePhysicalPlaces, updateLogicalPlaces, updateParticipantPath, updateReachables } from './env.js';
import { updateEnv } from './update_env.js';
import Translator from './translate.js';

// TODO: substitute with actual provider URL
// const provider = new JsonRpcProvider('http://localhost:7545');
// const provider = new JsonRpcProvider('http://host.docker.internal:7545');
// const wallet = new Wallet('0x2306563736f2448a1dd18fe8137c6a79c91589345741a874174141684240dc91', provider);
export let envContract = null;
export let chorContract = null;

const app = express();
app.use(cors({ origin: 'http://localhost:9013' }));
app.use(bodyParser.text({ type: 'application/xml' }));
app.use(bodyParser.json());

app.post('/deploy', async (req, res) => {
  try {
    const { bpmnContent, envJson, myAddress } = req.body;

    if (!bpmnContent || !envJson || !myAddress) {
      return res.status(400).json({ success: false, error: 'Missing BPMN, ENV data, or address' });
    }

    await fs.writeFile('./models/chor.bpmn', bpmnContent.xml); // già stringa
    await fs.writeFile('./models/env.json', JSON.stringify(envJson, null, 2));

    // Estrai dinamicamente i partecipanti dal BPMN
    const participantNames = await getParticipants('./models/chor.bpmn');

    // Genera participantsConfig usando myAddress per tutti i partecipanti
    const participantsConfig = {};
    participantNames.forEach(name => {
      participantsConfig[name] = myAddress;
    });

    // Tutti i partecipanti diventano mandatoryRoles
    const mandatoryRoles = [...participantNames];

    const translator = new Translator();
    const result = await translator.translateBPMNFile(
      './models/chor.bpmn',
      participantsConfig,
      [],
      mandatoryRoles
    );

    const chorSolPath = './contracts/chor.sol';
    await fs.writeFile(chorSolPath, result.solidityCode);

    const envArtifact = compileContract('env.sol');
    const chorArtifact = compileContract('chor.sol');

    res.json({
      success: true,
      payload: {
        envAbi: envArtifact.abi,
        envBytecode: envArtifact.bytecode,
        chorAbi: chorArtifact.abi,
        chorBytecode: chorArtifact.bytecode
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

async function getParticipants(filePath) {
  const xmlContent = await fs.readFile(filePath, 'utf-8');
  const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
  const result = await parser.parseStringPromise(xmlContent);

  const choreography = result['bpmn2:definitions']['bpmn2:choreography'];
  if (!choreography) return [];

  const participants = choreography['bpmn2:participant'];
  if (!participants) return [];

  // Assicurati di avere un array
  const participantArray = Array.isArray(participants) ? participants : [participants];

  // Estrai solo i nomi
  const names = participantArray.map(p => p.name);

  return names;
}

app.post('/setContracts', (req, res) => {
  try {
    const { envAddress, envAbi, chorAddress, chorAbi } = req.body;

    if (!envAddress || !envAbi || !chorAddress || !chorAbi) {
      return res.status(400).json({ success: false, error: 'Missing contract data' });
    }

    envContract = new Contract(envAddress, envAbi);
    chorContract = new Contract(chorAddress, chorAbi);

    console.log('Contracts stored on backend:');
    console.log('ENV:', envAddress);
    console.log('CHOR:', chorAddress);

    return res.json({ success: true, message: 'Contracts saved successfully' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/env/updatePhysicalPlaces', async (req, res) => {
  if (!envContract) return res.status(500).json({ error: 'Environment contract not set' });
  const { ids, attributeKeysList, attributeValuesList } = req.body;
  try {
    const result = await updatePhysicalPlaces(envContract, ids, attributeKeysList, attributeValuesList);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/env/updateLogicalPlaces', async (req, res) => {
  if (!envContract) return res.status(500).json({ error: 'Environment contract not set' });
  const { ids, attributeKeysList, attributeValuesList, updatedPlacesList } = req.body;
  try {
    const result = await updateLogicalPlaces(envContract, ids, attributeKeysList, attributeValuesList, updatedPlacesList);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/env/updateParticipantPath', async (req, res) => {
  if (!envContract) return res.status(500).json({ error: 'Environment contract not set' });
  const { role, traversedPhysicalPlaces } = req.body;
  try {
    const result = await updateParticipantPath(envContract, role, traversedPhysicalPlaces);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/env/updateReachables', async (req, res) => {
  if (!envContract) return res.status(500).json({ error: 'Environment contract not set' });
  const { conditions, values } = req.body;
  try {
    const result = await updateReachables(envContract, conditions, values);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/env/update', async (req, res) => {
  if (!envContract) return res.status(500).json({ error: 'Environment contract not set' });
  try {
    await updateEnv(envContract);
    res.json({ success: true, message: 'Environment updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(3000, () => console.log('Server listening on http://localhost:3000'));
