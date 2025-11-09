const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const solc = require('solc');
const { Web3 } = require('web3');

const { parseBpmn } = require('./parser-enhanced.js');
const { buildIntermediateModel } = require('./model-enhanced.js');
const { generateSolidity } = require('./generator-enhanced.js');

const app = express();
app.use(cors());
app.options('/convert', cors());
app.options('/deploy', cors());

app.use(bodyParser.text({ type: 'application/xml' }));
app.use(bodyParser.json()); // per ricevere JSON con codice Solidity

// Endpoint convert: BPMN -> Solidity (come già hai)
app.post('/convert', async (req, res) => {
  console.log('>>> Received XML length:', req.body.length);
  try {
    const tempFilePath = path.join(__dirname, 'temp_bpmn.xml');
    fs.writeFileSync(tempFilePath, req.body);

    const parsed = await parseBpmn(tempFilePath);
    fs.unlinkSync(tempFilePath);

    const model = buildIntermediateModel(parsed);
    const code = generateSolidity(model);

    console.log("Sending response");
    return res.json({ success: true, solidityCode: code });
  } catch (err) {
    console.error('Conversion error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Nuovo endpoint deploy: prende Solidity e fa deploy su Ganache
app.post('/deploy', async (req, res) => {
  try {
    const source = req.body.solidityCode;
    if (!source) {
      return res.status(400).json({ success: false, error: 'No solidityCode provided' });
    }

    // Compila con solc-js
    const input = {
      language: 'Solidity',
      sources: { 'Contract.sol': { content: source } },
      settings: {
        outputSelection: {
          '*': {
            '*': ['abi', 'evm.bytecode']
          }
        }
      }
    };
    const output = JSON.parse(solc.compile(JSON.stringify(input)));

    if (output.errors && output.errors.length > 0) {
      // Controlla gli errori di compilazione
      const errors = output.errors.filter(e => e.severity === 'error');
      if (errors.length > 0) {
        return res.status(400).json({ success: false, error: errors.map(e => e.formattedMessage).join('\n') });
      }
    }

    const contractName = Object.keys(output.contracts['Contract.sol'])[0];
    const contract = output.contracts['Contract.sol'][contractName];
    const abi = contract.abi;
    const bytecode = contract.evm.bytecode.object;

    // Configura web3 e Ganache
    const web3 = new Web3('http://127.0.0.1:7545');
    const accounts = await web3.eth.getAccounts();
    const deployAccount = accounts[0];

    const contractInstance = new web3.eth.Contract(abi);

    // Deploy contratto
    const deployed = await contractInstance.deploy({ data: '0x' + bytecode })
      .send({ from: deployAccount, gas: 3000000 });

    console.log('Contract deployed at:', deployed.options.address);

    return res.json({ success: true, contractAddress: deployed.options.address });
  } catch (err) {
    console.error('Deploy error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
