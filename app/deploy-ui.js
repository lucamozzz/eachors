import Web3 from 'web3';

let web3;
let contractInstance;
let interactionState = {}; 
let pollingInterval = null;

export function addDeployButtonToCanvas(modeler) {
  const canvasContainer = document.getElementById("canvas");
  if (!canvasContainer) return;
  if (document.getElementById("deploy-contract-btn")) return;

  // --- UI Container (Alto Destra) ---
  const toolsDiv = document.createElement("div");
  toolsDiv.id = "contract-tools";
  toolsDiv.style.cssText = `
    position: absolute;
    top: 20px;
    right: 20px;
    z-index: 100;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-end;
  `;

  const btnStyle = `
    padding: 8px 12px;
    background: #fff;
    border: 1px solid #ccc;
    border-radius: 4px;
    cursor: pointer;
    font-family: Arial, sans-serif;
    font-size: 13px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    font-weight: 600;
  `;

  // Bottone Generazione
  const generateBtn = document.createElement("button");
  generateBtn.id = "generate-contract-btn";
  generateBtn.textContent = "📄 Generate Solidity Contract";
  generateBtn.style.cssText = btnStyle;
  toolsDiv.appendChild(generateBtn);

  // Bottone Deploy (Disabilitato inizialmente)
  const deployBtn = document.createElement("button");
  deployBtn.id = "deploy-contract-btn";
  deployBtn.textContent = "🚀 Deploy to Smart Contract";
  deployBtn.style.cssText = btnStyle;
  deployBtn.disabled = true;
  deployBtn.style.opacity = "0.6";
  toolsDiv.appendChild(deployBtn);

  canvasContainer.appendChild(toolsDiv);

  // --- LOGICA BOTTONI ---

  generateBtn.onclick = async () => {
    try {
      generateBtn.textContent = "⏳ Generating...";
      
      const { xml } = await modeler.saveXML({ format: true });
      const response = await fetch("http://localhost:3000/convert", {
        method: "POST",
        headers: { "Content-Type": "application/xml" },
        body: xml
      });

      const conversion = await response.json();
      
      if (conversion.success) {
        window.__LAST_CONTRACT__ = conversion.solidityCode;
        
        generateBtn.textContent = "📄 Regenerate Contract";
        
        // Abilita il deploy
        deployBtn.disabled = false;
        deployBtn.style.opacity = "1";
        deployBtn.style.background = "#e3f2fd";
        deployBtn.style.borderColor = "#2196f3";
        deployBtn.style.color = "#0d47a1";

        // 🔥 NUOVA FUNZIONE: MOSTRA L'ANTEPRIMA DEL CODICE
        showContractPreview(conversion.solidityCode);
        
      } else {
        alert("Generazione fallita: " + conversion.error);
        generateBtn.textContent = "📄 Generate Solidity Contract";
      }
    } catch (err) {
      console.error(err);
      alert("Errore di connessione al server.");
      generateBtn.textContent = "📄 Generate Solidity Contract";
    }
  };

  deployBtn.onclick = async () => {
    try {
      const solidityCode = window.__LAST_CONTRACT__;
      if (!solidityCode) return;

      deployBtn.textContent = "⏳ Deploying...";
      
      const response = await fetch('http://localhost:3000/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ solidityCode })
      });

      const result = await response.json();
      
      if (result.success) {
        deployBtn.textContent = "✅ Deployed";
        deployBtn.style.background = "#e8f5e9";
        deployBtn.style.borderColor = "#4caf50";
        deployBtn.style.color = "#1b5e20";
        
        alert("Contratto deployato con successo!\nIndirizzo: " + result.contractAddress);
        
        if (result.abi) {
            initBlockchainInteraction(modeler, result.contractAddress, result.abi);
        }
      } else {
        deployBtn.textContent = "❌ Failed";
        alert("Deploy fallito: " + result.error);
      }
    } catch (err) {
      console.error(err);
      deployBtn.textContent = "❌ Error";
      alert("Errore durante il deploy: " + err.message);
    }
  };
}

// ---------------------------------------------------------
// 🔥 NUOVA FUNZIONE PER L'ANTEPRIMA DEL CODICE
// ---------------------------------------------------------
function showContractPreview(code) {
    // Rimuovi se ne esiste già uno
    const existing = document.getElementById("contract-preview-popup");
    if (existing) document.body.removeChild(existing);

    const popup = document.createElement("div");
    popup.id = "contract-preview-popup";
    popup.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 600px;
        max-width: 90%;
        height: 500px;
        background: white;
        border: 2px solid #333;
        border-radius: 8px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.4);
        z-index: 2000;
        display: flex;
        flex-direction: column;
        font-family: Arial, sans-serif;
    `;

    const header = document.createElement("div");
    header.style.cssText = `
        padding: 10px 15px;
        background: #f0f0f0;
        border-bottom: 1px solid #ccc;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-weight: bold;
    `;
    header.innerHTML = `<span>Anteprima Contratto Solidity</span>`;
    
    const closeBtn = document.createElement("button");
    closeBtn.textContent = "✕ Chiudi";
    closeBtn.style.cursor = "pointer";
    closeBtn.onclick = () => document.body.removeChild(popup);
    header.appendChild(closeBtn);

    const textarea = document.createElement("textarea");
    textarea.readOnly = true;
    textarea.value = code;
    textarea.style.cssText = `
        flex: 1;
        width: 100%;
        box-sizing: border-box;
        padding: 10px;
        font-family: 'Consolas', 'Monaco', monospace;
        font-size: 12px;
        border: none;
        resize: none;
        background: #fafafa;
        color: #333;
        outline: none;
    `;

    popup.appendChild(header);
    popup.appendChild(textarea);
    document.body.appendChild(popup);
}

// ---------------------------------------------------------
// --- LE ALTRE FUNZIONI (INTERAZIONE BLOCKCHAIN) ---
// (Queste rimangono identiche a prima, le ricopio per completezza)
// ---------------------------------------------------------

async function initBlockchainInteraction(modeler, address, abi) {
    web3 = new Web3("http://localhost:7545"); 
    contractInstance = new web3.eth.Contract(abi, address);
    startPolling(modeler);
    setupClickListener(modeler, abi);
}

function startPolling(modeler) {
    const canvas = modeler.get('canvas');
    if (pollingInterval) clearInterval(pollingInterval);

    pollingInterval = setInterval(async () => {
        try {
            const result = await contractInstance.methods.getCurrentState().call();
            const elements = result[0]; 
            elements.forEach(el => {
                const bpmnId = el.ID;
                const status = parseInt(el.status); 
                interactionState[bpmnId] = status;
                updateElementColor(canvas, bpmnId, status);
            });
        } catch (err) { }
    }, 1500); 
}

function updateElementColor(canvas, elementId, status) {
    canvas.removeMarker(elementId, 'highlight-yellow');
    canvas.removeMarker(elementId, 'highlight-green');
    canvas.removeMarker(elementId, 'highlight-red');
    if (status === 1) canvas.addMarker(elementId, 'highlight-green'); 
    else if (status === 2) canvas.addMarker(elementId, 'highlight-red');   
}

function setupClickListener(modeler, abi) {
    const eventBus = modeler.get('eventBus');
    eventBus.off('element.click');
    eventBus.on('element.click', (e) => {
        const element = e.element;
        const elementId = element.id;
        if (interactionState[elementId] === 1) {
            const functionName = elementId.replace(/-/g, '_');
            const methodAbi = abi.find(m => m.name === functionName && m.type === 'function');
            if (methodAbi) {
                const messageParams = extractMessageParams(element);
                showInputPopup(functionName, methodAbi, messageParams);
            }
        }
    });
}

function extractMessageParams(element) {
    let params = [];
    if (element.type === 'bpmn:ChoreographyTask') {
        const bo = element.businessObject;
        if (bo.messageFlowRef && bo.messageFlowRef.length > 0) {
            const messageFlow = bo.messageFlowRef[0];
            if (messageFlow.messageRef) {
                const messageName = messageFlow.messageRef.name;
                if (messageName && messageName.includes('(')) {
                    const match = messageName.match(/\(([^)]+)\)/);
                    if (match) {
                        const rawParams = match[1].split(',');
                        params = rawParams.map(p => {
                            const parts = p.trim().split(/\s+/);
                            return { type: parts[0] || 'string', name: parts[1] || 'param' };
                        });
                    }
                }
            }
        }
    }
    return params;
}

function showInputPopup(functionName, methodAbi, messageParams) {
    const existing = document.querySelector('.blockchain-popup');
    if (existing) document.body.removeChild(existing);

    const popup = document.createElement('div');
    popup.className = 'token-popup blockchain-popup'; 
    popup.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: white; padding: 25px; border-radius: 8px; 
        box-shadow: 0 10px 25px rgba(0,0,0,0.2); z-index: 2000;
        min-width: 350px; font-family: Arial, sans-serif;
    `;

    const title = document.createElement('h3');
    title.innerText = `📩 Invia Messaggio: ${functionName}`;
    title.style.marginTop = "0";
    title.style.borderBottom = "1px solid #eee";
    title.style.paddingBottom = "10px";
    popup.appendChild(title);

    const inputs = [];
    const paramsToRender = (messageParams.length > 0) ? messageParams : methodAbi.inputs;

    if (!paramsToRender || paramsToRender.length === 0) {
        const info = document.createElement('p');
        info.innerText = "Nessun parametro richiesto.";
        popup.appendChild(info);
    } else {
        paramsToRender.forEach((param) => {
            const wrapper = document.createElement('div');
            wrapper.style.marginBottom = "15px";
            
            const label = document.createElement('label');
            label.innerText = `${param.name} (${param.type})`;
            label.style.display = "block";
            label.style.fontSize = "12px";
            label.style.color = "#666";
            label.style.marginBottom = "5px";
            label.style.fontWeight = "bold";
            
            const field = document.createElement('input');
            field.type = (param.type && param.type.includes('int')) ? 'number' : 'text';
            field.placeholder = `Inserisci ${param.name}`;
            field.style.width = "100%";
            field.style.padding = "8px";
            field.style.boxSizing = "border-box";
            field.style.border = "1px solid #ccc";
            field.style.borderRadius = "4px";
            
            wrapper.appendChild(label);
            wrapper.appendChild(field);
            popup.appendChild(wrapper);
            inputs.push(field);
        });
    }

    const btnContainer = document.createElement('div');
    btnContainer.style.display = "flex";
    btnContainer.style.justifyContent = "flex-end";
    btnContainer.style.gap = "10px";
    btnContainer.style.marginTop = "20px";

    const cancelBtn = document.createElement('button');
    cancelBtn.innerText = "Annulla";
    cancelBtn.style.cssText = "padding: 8px 15px; border: none; background: #f5f5f5; cursor: pointer; border-radius: 4px;";
    cancelBtn.onclick = () => document.body.removeChild(popup);

    const sendBtn = document.createElement('button');
    sendBtn.innerText = "Conferma e Invia";
    sendBtn.style.cssText = "padding: 8px 15px; border: none; background: #4CAF50; color: white; cursor: pointer; border-radius: 4px; font-weight: bold;";
    
    sendBtn.onclick = async () => {
        const args = inputs.map(i => i.value);
        try {
            sendBtn.innerText = "Invio in corso...";
            sendBtn.disabled = true;
            const accounts = await web3.eth.getAccounts();
            await contractInstance.methods[functionName](...args).send({ from: accounts[0], gas: 6721975 });
            alert("✅ Transazione inviata con successo!");
            document.body.removeChild(popup);
        } catch (err) {
            console.error(err);
            alert("❌ Errore: " + err.message);
            sendBtn.innerText = "Riprova";
            sendBtn.disabled = false;
        }
    };

    btnContainer.appendChild(cancelBtn);
    btnContainer.appendChild(sendBtn);
    popup.appendChild(btnContainer);
    document.body.appendChild(popup);
}