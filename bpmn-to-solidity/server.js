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
app.use(bodyParser.text({ type: 'application/xml' }));
app.use(bodyParser.json());

// Endpoint convert
app.post('/convert', async (req, res) => {
  try {
    const tempFilePath = path.join(__dirname, 'temp_bpmn.xml');
    fs.writeFileSync(tempFilePath, req.body);
    const parsed = await parseBpmn(tempFilePath);
    fs.unlinkSync(tempFilePath);
    const model = buildIntermediateModel(parsed);
    const code = generateSolidity(model);
    return res.json({ success: true, solidityCode: code });
  } catch (err) {
    console.error('Conversion error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Endpoint deploy
app.post('/deploy', async (req, res) => {
  try {
    const source = req.body.solidityCode;
    if (!source) return res.status(400).json({ success: false, error: 'No solidityCode provided' });

    console.log("🚀 Starting Compilation...");

    // Configurazione SOLC con Ottimizzatore Aggressivo
    const input = {
      language: 'Solidity',
      sources: { 'Contract.sol': { content: source } },
      settings: {
        optimizer: {
            enabled: true,
            runs: 1 // Ottimizza per la dimensione minima del bytecode
        },
        outputSelection: {
          '*': {
            '*': ['abi', 'evm.bytecode']
          }
        }
      }
    };

    const output = JSON.parse(solc.compile(JSON.stringify(input)));

    // Gestione Errori Compilazione
    if (output.errors) {
      const errors = output.errors.filter(e => e.severity === 'error');
      if (errors.length > 0) {
        console.error("❌ Compilation Errors:", errors);
        return res.status(400).json({ success: false, error: errors.map(e => e.formattedMessage).join('\n') });
      }
    }

    // Trova il contratto compilato (qualsiasi nome abbia)
    const fileOutput = output.contracts['Contract.sol'];
    const contractName = Object.keys(fileOutput)[0]; // Prende il primo contratto trovato
    const contract = fileOutput[contractName];
    
    console.log(`✅ Compiled Contract: ${contractName}`);

    const abi = contract.abi;
    const bytecode = contract.evm.bytecode.object;

    if (!bytecode || bytecode === "") {
        throw new Error("Bytecode generation failed. The contract might be abstract or empty.");
    }

    // Deploy su Ganache
    console.log("📤 Deploying to Ganache...");
    const web3 = new Web3('http://127.0.0.1:7545');
    const accounts = await web3.eth.getAccounts();
    const deployAccount = accounts[0];

    const contractInstance = new web3.eth.Contract(abi);

    const deployed = await contractInstance.deploy({ data: '0x' + bytecode })
      .send({ from: deployAccount, gas: 6721975 }); // Gas limit alto per sicurezza

    console.log('🎉 Contract deployed at:', deployed.options.address);

    return res.json({ 
        success: true, 
        contractAddress: deployed.options.address,
        abi: abi 
    });

  } catch (err) {
    console.error('❌ Deploy error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));