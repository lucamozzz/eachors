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
app.use(bodyParser.json({ limit: '50mb' })); // Aumentato limite per JSON grossi
app.use(bodyParser.text({ type: 'application/xml' }));

// Helper per bytes32 (Preso dal tuo vecchio script)
const toBytes32 = (web3, str) => {
    if (typeof str === 'number') str = str.toString();
    // Gestione stringhe vuote o null
    if (!str) return '0x0000000000000000000000000000000000000000000000000000000000000000';
    return web3.utils.padRight(web3.utils.fromAscii(str), 64);
};

// 1. ENDPOINT NUOVO: DEPLOY ENVIRONMENT DA JSON
app.post('/deploy-env', async (req, res) => {
    try {
        console.log("🌍 Deploying Environment from Bpenv Model...");
        const envData = req.body; // Questo è il JSON che arriva da getModel()

        // Leggi e Compila env.sol
        const envSolPath = path.join(__dirname, 'env.sol'); // Assicurati che env.sol sia nella stessa cartella
        const envSolContent = fs.readFileSync(envSolPath, 'utf8');
        
        const input = {
            language: 'Solidity',
            sources: { 'env.sol': { content: envSolContent } },
            settings: { outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } } }
        };
        const output = JSON.parse(solc.compile(JSON.stringify(input)));
        const contractOutput = output.contracts['env.sol']['Environment'];
        const abi = contractOutput.abi;
        const bytecode = contractOutput.evm.bytecode.object;

        // Prepara Web3
        const web3 = new Web3('http://127.0.0.1:7545');
        const accounts = await web3.eth.getAccounts();
        const deployer = accounts[0];

        // --- TRASFORMAZIONE DATI (JSON -> Bytes32 Arrays) ---
        // (Logica identica a deploy-env.js ma adattata per i dati dinamici)
        
        // A. Attribute Keys
        const allAttributes = new Set();
        (envData.physicalPlaces || []).forEach(p => Object.keys(p.attributes || {}).forEach(k => allAttributes.add(k)));
        (envData.logicalPlaces || []).forEach(p => Object.keys(p.attributes || {}).forEach(k => allAttributes.add(k)));
        const attributeKeys = Array.from(allAttributes);
        const attributeKeysBytes = attributeKeys.map(k => toBytes32(web3, k));

        // B. Physical Places
        const ppKeys = (envData.physicalPlaces || []).map(p => p.id);
        const ppKeysBytes = ppKeys.map(k => toBytes32(web3, k));

        // C. Edges
        const edgeKeys = (envData.edges || []).map(e => e.id);
        const edgeKeysBytes = edgeKeys.map(k => toBytes32(web3, k));

        // D. Logical Places
        const lpKeys = (envData.logicalPlaces || []).map(l => l.id);
        const lpKeysBytes = lpKeys.map(k => toBytes32(web3, k));
        const lpExpressions = (envData.logicalPlaces || []).map(l => l.expression || l.operator || ""); 

        // E. Views
        const viewKeys = (envData.views || []).map(v => v.id);
        const viewKeysBytes = viewKeys.map(k => toBytes32(web3, k));

        // F. View Logical Places
        const viewLPs = (envData.views || []).map(v => (v.logicalPlaces || []).map(lp => toBytes32(web3, lp)));

        // G. View Aggregations
        const viewAggKeys = (envData.views || []).map(v => Object.keys(v.aggregations || {}).map(k => toBytes32(web3, k)));
        const viewAggVals = (envData.views || []).map(v => Object.values(v.aggregations || {}).map(val => toBytes32(web3, val)));

        // Deploy
        let totalGasEnv = 0;
        const Contract = new web3.eth.Contract(abi);
        const instance = await Contract.deploy({
            data: '0x' + bytecode,
            arguments: [
                attributeKeysBytes, ppKeysBytes, edgeKeysBytes, lpKeysBytes, 
                lpExpressions, viewKeysBytes, viewLPs, viewAggKeys, viewAggVals
            ]
        // Usa un valore alto, ma inferiore al limite impostato in Ganache (es. 30M)
}).send({ from: deployer, gas: 25000000 })
        .on('receipt', (receipt) => {
            console.log(`⛽ Environment Root Contract Gas: ${receipt.gasUsed}`);
            // Salviamo il gas parziale in una variabile (dobbiamo definire totalGas prima)
        });

        const envAddress = instance.options.address;
        console.log(`✅ Environment Deployed at: ${envAddress}`);

        // Update Attributes (Post-deploy population)
        // Nota: Per velocità, qui facciamo un loop. In produzione si farebbe in batch.
        for (const place of (envData.physicalPlaces || [])) {
            const placeIdBytes = toBytes32(web3, place.id);
            const attrs = Object.entries(place.attributes || {});
            if(attrs.length > 0) {
                const attrKeysList = attrs.map(([k, v]) => toBytes32(web3, k));
                const attrValList = attrs.map(([k, v]) => toBytes32(web3, v));
                await instance.methods.updatePhysicalPlaces([placeIdBytes], [attrKeysList], [attrValList])
                    .send({ from: deployer, gas: 5000000 })
                    .on('receipt', (r) => { 
                        totalGasEnv += Number(r.gasUsed);
                        // console.log(`   + Attr Update Gas: ${r.gasUsed}`); 
                    });
            }
        }

        res.json({ success: true, address: envAddress, totalGas: totalGasEnv });
        console.log(`⛽ Total Environment Gas Cost (approx): ${totalGasEnv}`);

    } catch (err) {
        console.error("❌ Env Deploy Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. MODIFICA CONVERT: ACCETTA XML E ENV_ADDRESS
app.post('/convert', async (req, res) => {
  try {
    // Ora ci aspettiamo un JSON con { xml: "...", envAddress: "..." }
    // Oppure testo semplice (xml) per retrocompatibilità
    let xmlContent, envAddress;

    if (req.body.xml) {
        xmlContent = req.body.xml;
        envAddress = req.body.envAddress;
    } else {
        xmlContent = req.body; // Fallback text/plain
    }

    const tempFilePath = path.join(__dirname, 'temp_bpmn.xml');
    fs.writeFileSync(tempFilePath, xmlContent);
    const parsed = await parseBpmn(tempFilePath);
    fs.unlinkSync(tempFilePath);
    
    const model = buildIntermediateModel(parsed);
    // Passiamo l'indirizzo dinamico al generatore!
    const code = generateSolidity(model, envAddress);
    
    return res.json({ success: true, solidityCode: code });
  } catch (err) {
    console.error('Conversion error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint deploy (Choreography) - RIMANE UGUALE A PRIMA (con logica smart)
app.post('/deploy', async (req, res) => {
    // ... (Copia qui il contenuto esatto dell'endpoint /deploy che ti ho dato nel messaggio precedente, quello "Smart")
    // Lo ometto per brevità ma è fondamentale che sia quello che scarta le interfacce.
    try {
    const source = req.body.solidityCode;
    if (!source) return res.status(400).json({ success: false, error: 'No solidityCode provided' });

    console.log("🚀 Starting Compilation...");

    const input = {
      language: 'Solidity',
      sources: { 'Contract.sol': { content: source } },
      settings: {
        optimizer: { enabled: true, runs: 1 },
        outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } }
      }
    };

    const output = JSON.parse(solc.compile(JSON.stringify(input)));
    if (output.errors) {
        // Filtra warning
        const errs = output.errors.filter(e => e.severity === 'error');
        if(errs.length > 0) return res.status(400).json({success: false, error: errs[0].formattedMessage});
    }

    const fileOutput = output.contracts['Contract.sol'];
    let contractName = null; 
    let contract = null;

    for (const key in fileOutput) {
        const bytecode = fileOutput[key].evm.bytecode.object;
        if (bytecode && bytecode.length > 0 && key !== 'IEnvironment') {
            contractName = key;
            contract = fileOutput[key];
            break;
        }
    }

    if (!contract) throw new Error("No deployable contract found.");

    const web3 = new Web3('http://127.0.0.1:7545');
    const accounts = await web3.eth.getAccounts();
    const deployTx = new web3.eth.Contract(contract.abi).deploy({ data: '0x' + contract.evm.bytecode.object });
    const deployed = await deployTx.send({ from: accounts[0], gas: 6721975 })
                                .on('receipt', (r) => {
                                    console.log(`⛽ Choreography Contract Gas: ${r.gasUsed}`);
                                });

    return res.json({ success: true, contractAddress: deployed.options.address, abi: contract.abi });
    } catch(e) {
        res.status(500).json({success:false, error: e.message});
    }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));