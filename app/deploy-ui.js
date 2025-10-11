// app/deploy-ui.js

/**
 * Adds “Deploy to Smart Contract” and “Download Solidity” buttons to the BPMN canvas,
 * and hooks them up to the backend conversion service.
 */
export function addDeployButtonToCanvas(modeler) {
    console.count("addDeployButtonToCanvas called");
  const canvasContainer = document.getElementById("canvas");
  if (!canvasContainer) return;

  // Avoid duplicates
  if (document.getElementById("deploy-contract-btn")) return;

  // Container for buttons and preview
  const toolsDiv = document.createElement("div");
  toolsDiv.id = "contract-tools";
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

  // Deploy button
  const deployBtn = document.createElement("button");
  deployBtn.id = "deploy-contract-btn";
  deployBtn.textContent = "Deploy to Smart Contract";
  toolsDiv.appendChild(deployBtn);

  // Download button
  const downloadBtn = document.createElement("button");
  downloadBtn.id = "download-contract-btn";
  downloadBtn.textContent = "Download Solidity";
  downloadBtn.style.display = "none";
  toolsDiv.appendChild(downloadBtn);

  // Preview textarea
  const previewDiv = document.createElement("div");
  previewDiv.id = "contract-preview";
  previewDiv.style = "margin-top:8px; display:none;";
  const textarea = document.createElement("textarea");
  textarea.id = "contract-textarea";
  textarea.rows = 10;
  textarea.cols = 60;
  textarea.readOnly = true;
  previewDiv.appendChild(textarea);
  toolsDiv.appendChild(previewDiv);

  canvasContainer.insertBefore(toolsDiv, canvasContainer.firstChild);

  // Deploy button logic
  deployBtn.onclick = async () => {
    console.log("⏳ Deploy button clicked");
  try {
    // 1) Salva XML e loggalo
    const { xml } = await modeler.saveXML({ format: true });
    console.log('XML to convert (first 200 chars):', xml.slice(0, 200));

    // 2) Effettua la chiamata e logga la response grezza
    const response = await fetch("http://localhost:3000/convert", {
      method: "POST",
      headers: { "Content-Type": "application/xml" },
      body: xml
    });
    console.log('Fetch response status:', response.status, response.statusText);

    // 3) Prova a leggere il JSON o il testo di errore
    let conversion;
    try {
      conversion = await response.json();
      console.log('Conversion JSON:', conversion);
    } catch (jsonErr) {
      const text = await response.text();
      console.error('Error parsing JSON response:', text);
      alert('Server returned invalid JSON');
      return;
    }

    // 4) Gestisci il risultato
    if (conversion.success) {
      downloadBtn.style.display = "inline-block";
      previewDiv.style.display = "block";
      textarea.value = conversion.solidityCode;
      window.__LAST_CONTRACT__ = conversion.solidityCode;
    } else {
      console.error('Conversion error from server:', conversion.error);
      alert("Conversion error: " + conversion.error);
    }
  } catch (err) {
    console.error('Network or unexpected error:', err);
    alert("Network or server error: " + err.message);
  }
};


  // Download button logic
  downloadBtn.onclick = () => {
    const code = window.__LAST_CONTRACT__;
    if (!code) return;
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Choreography.sol";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  console.log(">>> deploy-ui.js loaded");

}
