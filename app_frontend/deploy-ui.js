export function addDeployButtonToCanvas(modeler) {
  console.count('addDeployButtonToCanvas called');
  const canvasContainer = document.getElementById('canvas');
  if (!canvasContainer) return;

  if (document.getElementById('deploy-contract-btn')) return;

  const toolsDiv = document.createElement('div');
  toolsDiv.id = 'contract-tools';
  toolsDiv.style.cssText = `
    position: absolute;
    bottom: 180px;
    left: 20px;
    z-index: 100;
    font-family: Arial, sans-serif;
    font-size: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    background: transparent;
  `;

  const deployBtn = document.createElement('button');
  deployBtn.id = 'deploy-contract-btn';
  deployBtn.textContent = 'Deploy to Smart Contract';
  toolsDiv.appendChild(deployBtn);

  const downloadBtn = document.createElement('button');
  downloadBtn.id = 'download-contract-btn';
  downloadBtn.textContent = 'Download Solidity';
  downloadBtn.style.display = 'none';
  toolsDiv.appendChild(downloadBtn);

  const previewDiv = document.createElement('div');
  previewDiv.id = 'contract-preview';
  previewDiv.style = 'margin-top:8px; display:none;';
  const textarea = document.createElement('textarea');
  textarea.id = 'contract-textarea';
  textarea.rows = 10;
  textarea.cols = 60;
  textarea.readOnly = true;
  previewDiv.appendChild(textarea);
  toolsDiv.appendChild(previewDiv);

  canvasContainer.insertBefore(toolsDiv, canvasContainer.firstChild);

  // Nuovo bottone per generare Solidity dal BPMN (aggiungiamo il pulsante e chiamata a /convert)
  const generateBtn = document.createElement('button');
  generateBtn.id = 'generate-contract-btn';
  generateBtn.textContent = 'Generate Solidity Contract';
  toolsDiv.appendChild(generateBtn);

  generateBtn.onclick = async () => {
    try {
      const { xml } = await modeler.saveXML({ format: true });
      console.log('XML to convert (first 200 chars):', xml.slice(0, 200));

      const response = await fetch('http://localhost:3000/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/xml' },
        body: xml
      });

      const conversion = await response.json();
      if (conversion.success) {
        downloadBtn.style.display = 'inline-block';
        previewDiv.style.display = 'block';
        textarea.value = conversion.solidityCode;
        window.__LAST_CONTRACT__ = conversion.solidityCode;
        alert('Contract generated and ready for deploy!');
      } else {
        alert('Conversion error: ' + conversion.error);
      }
    } catch (err) {
      console.error('Error during contract generation:', err);
      alert('Error during contract generation: ' + err.message);
    }
  };

  deployBtn.onclick = async () => {
    console.log('⏳ Deploy button clicked');
    try {
      const solidityCode = window.__LAST_CONTRACT__;
      console.log('Current solidity code for deploy:', solidityCode);

      if (!solidityCode) {
        alert('No contract code available to deploy');
        return;
      }

      const response = await fetch('http://localhost:3000/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ solidityCode })
      });

      const result = await response.json();
      if (result.success) {
        alert('Contract deployed at: ' + result.contractAddress);
      } else {
        alert('Deploy failed: ' + result.error);
      }
    } catch (err) {
      console.error(err);
      alert('Unexpected error: ' + err.message);
    }
  };

  downloadBtn.onclick = () => {
    const code = window.__LAST_CONTRACT__;
    if (!code) return;
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Choreography.sol';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  console.log('>>> deploy-ui.js loaded');
}
