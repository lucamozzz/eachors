const fs = require('fs');
const path = require('path');
const solc = require('solc');
const { Web3 } = require('web3');

// Configurazione
const ENV_SOL_PATH = path.join(__dirname, 'env.sol');
const ENV_JSON_PATH = path.join(__dirname, 'env.json');
const GANACHE_URL = 'http://127.0.0.1:7545';

// Funzione Helper per convertire stringa -> bytes32 (Hex padded)
const toBytes32 = (web3, str) => {
    // Gestisce numeri passati come stringhe o numeri
    if (typeof str === 'number') str = str.toString();
    // Usa padRight per assicurarsi che sia lungo 32 bytes (64 hex chars)
    return web3.utils.padRight(web3.utils.fromAscii(str), 64);
};

async function deployEnvironment() {
    try {
        console.log("🔹 1. Lettura files...");
        const envSolContent = fs.readFileSync(ENV_SOL_PATH, 'utf8');
        const envData = JSON.parse(fs.readFileSync(ENV_JSON_PATH, 'utf8'));

        console.log("🔹 2. Compilazione env.sol...");
        const input = {
            language: 'Solidity',
            sources: { 'env.sol': { content: envSolContent } },
            settings: { outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } } }
        };
        const output = JSON.parse(solc.compile(JSON.stringify(input)));
        
        if (output.errors) {
            const errors = output.errors.filter(e => e.severity === 'error');
            if (errors.length > 0) {
                console.error("❌ Errore Compilazione:", errors);
                return;
            }
        }

        const contractOutput = output.contracts['env.sol']['Environment'];
        const abi = contractOutput.abi;
        const bytecode = contractOutput.evm.bytecode.object;

        console.log("🔹 3. Preparazione dati dal JSON...");
        const web3 = new Web3(GANACHE_URL);
        const accounts = await web3.eth.getAccounts();
        const deployer = accounts[0];

        // --- PREPARAZIONE ARGOMENTI COSTRUTTORE ---
        // Il costruttore di env.sol richiede molti array. Dobbiamo estrarli dal JSON.

        // A. Extract Attribute Keys (Unique)
        const allAttributes = new Set();
        envData.physicalPlaces.forEach(p => Object.keys(p.attributes).forEach(k => allAttributes.add(k)));
        envData.logicalPlaces.forEach(p => Object.keys(p.attributes).forEach(k => allAttributes.add(k)));
        const attributeKeys = Array.from(allAttributes);
        const attributeKeysBytes = attributeKeys.map(k => toBytes32(web3, k));

        // B. Physical Places
        const ppKeys = envData.physicalPlaces.map(p => p.id);
        const ppKeysBytes = ppKeys.map(k => toBytes32(web3, k));

        // C. Edges (il JSON ha un array "edges")
        const edgeKeys = envData.edges ? envData.edges.map(e => e.id) : [];
        const edgeKeysBytes = edgeKeys.map(k => toBytes32(web3, k));

        // D. Logical Places
        const lpKeys = envData.logicalPlaces.map(l => l.id);
        const lpKeysBytes = lpKeys.map(k => toBytes32(web3, k));
        const lpExpressions = envData.logicalPlaces.map(l => l.operator || ""); // env.sol chiede 'expressions' (string)

        // E. Views
        const viewKeys = envData.views ? envData.views.map(v => v.id) : [];
        const viewKeysBytes = viewKeys.map(k => toBytes32(web3, k));

        // F. View Logical Places (Array of Arrays)
        const viewLPs = envData.views ? envData.views.map(v => v.logicalPlaces.map(lp => toBytes32(web3, lp))) : [];

        // G. View Aggregations (Keys and Values)
        const viewAggKeys = envData.views ? envData.views.map(v => Object.keys(v.aggregations).map(k => toBytes32(web3, k))) : [];
        const viewAggVals = envData.views ? envData.views.map(v => Object.values(v.aggregations).map(val => toBytes32(web3, val))) : [];

        // H. Update Physical Attributes (Post-Deploy simulation)
        // Poiché env.sol non prende i valori degli attributi nel costruttore (ma solo le chiavi),
        // dobbiamo salvarli per fare delle chiamate "update" dopo il deploy.
        
        console.log("🔹 4. Deploy Environment Contract...");
        const Contract = new web3.eth.Contract(abi);
        
        const instance = await Contract.deploy({
            data: '0x' + bytecode,
            arguments: [
                attributeKeysBytes,
                ppKeysBytes,
                edgeKeysBytes,
                lpKeysBytes,
                lpExpressions,
                viewKeysBytes,
                viewLPs,
                viewAggKeys,
                viewAggVals
            ]
        }).send({ from: deployer, gas: 6000000 });

        const envAddress = instance.options.address;
        console.log(`✅ ENVIRONMENT DEPLOYATO A: ${envAddress}`);

        // --- POPOLAMENTO DATI (UPDATE) ---
        console.log("🔹 5. Popolamento dati iniziali (Attributi)...");

        // Per ogni Physical Place nel JSON, aggiorniamo i suoi attributi su Blockchain
        for (const place of envData.physicalPlaces) {
            const placeIdBytes = toBytes32(web3, place.id);
            const attrs = Object.entries(place.attributes);
            
            // Prepara array per update massivo
            const attrKeysList = attrs.map(([k, v]) => toBytes32(web3, k));
            const attrValList = attrs.map(([k, v]) => toBytes32(web3, v));
            
            // Chiamata updatePhysicalPlaces (richiede array di places)
            // Facciamo una chiamata per ogni place per semplicità di script
            await instance.methods.updatePhysicalPlaces(
                [placeIdBytes],
                [attrKeysList],
                [attrValList]
            ).send({ from: deployer, gas: 500000 });
            
            console.log(`   -> Aggiornato ${place.id} (${attrs.length} attributi)`);
        }

        console.log("\n✨ TUTTO COMPLETATO! ✨");
        console.log("👉 Copia questo indirizzo nel tuo generatore:");
        console.log(envAddress);

    } catch (err) {
        console.error("❌ Errore durante il processo:", err);
    }
}

deployEnvironment();