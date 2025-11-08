// app/bpmn-to-solidity/server.cjs

const express    = require('express');
const cors       = require('cors');
const bodyParser = require('body-parser');
const { parseBpmn }              = require('./parser-enhanced.js');
const fs = require('fs');
const path = require('path');
const { buildIntermediateModel } = require('./model-enhanced.js');
const { generateSolidity }       = require('./generator-enhanced.js');

const app = express();

// 1) CORS GENERALE
app.use(cors());

// 2) PRELIGHT SPECIFICO PRIMA DEL BODY PARSER
app.options('/convert', cors());

// 3) BODY PARSER PER XML SOLO DOPO LE OPTIONS
app.use(bodyParser.text({ type: 'application/xml' }));

// 4) ENDPOINT
app.post('/convert', async (req, res) => {
  console.log('>>> Received XML length:', req.body.length);
  try {
    // Scrive il body XML su un file temporaneo
    const tempFilePath = path.join(__dirname, 'temp_bpmn.xml');
    fs.writeFileSync(tempFilePath, req.body);

    const parsed = await parseBpmn(tempFilePath);
    
    // Rimuove il file temporaneo
    fs.unlinkSync(tempFilePath);
    const model  = buildIntermediateModel(parsed);
    const code   = generateSolidity(model);
    console.log("Sending response")
    return res.json({ success: true, solidityCode: code });
  } catch (err) {
    console.error('Conversion error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = 3000;
app.listen(PORT, () =>
  console.log(`Converter listening on http://localhost:${PORT}/convert`)
);
