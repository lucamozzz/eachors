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
            deployBtn.textContent = "🌍 Deploying Environment...";
            deployBtn.disabled = true;

            // 2. DEPLOY ENVIRONMENT (Se esiste tab environment)
            const bpEnvModeler = window.bpmnjs; // Window global hack
            let envAddress = "0x0000000000000000000000000000000000000000";
            let envResult = null; // FIX: Declare here to be accessible below

            if (bpEnvModeler) {
                deployBtn.textContent = "🌍 Deploying Environment...";
                const { xml } = await bpEnvModeler.saveXML({ format: true });
                const envModelData = { xml }; // FIX: Usa l'XML appena salvato, getModel() non esiste.

                // ... (chiamata fetch)
                const envResponse = await fetch('http://localhost:3000/deploy-env', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(envModelData)
                });
                envResult = await envResponse.json(); // FIX: Assign to outer variable

                if (!envResult.success) throw new Error("Env Deploy Failed: " + envResult.error);
                envAddress = envResult.address;
                console.log("Environment deployato a:", envAddress);
            } else {
                console.warn("⚠️ BpenvModeler non trovato! Uso indirizzo default (Pizza mode).");
            }

            // 3. GENERAZIONE CONTRATTO CHOREOGRAPHY (Con l'indirizzo dinamico!)
            deployBtn.textContent = "⚙️ Generating Contract...";

            const { xml } = await modeler.saveXML({ format: true });

            const convertResponse = await fetch("http://localhost:3000/convert", {
                method: "POST",
                headers: { "Content-Type": "application/json" }, // Nota: JSON ora, non XML raw
                body: JSON.stringify({
                    xml: xml,
                    envAddress: envAddress // Passiamo l'indirizzo appena creato!
                })
            });

            const conversion = await convertResponse.json();
            if (!conversion.success) throw new Error("Generation Failed: " + conversion.error);

            const solidityCode = conversion.solidityCode;
            window.__LAST_CONTRACT__ = solidityCode; // Aggiorna anteprima

            // 4. DEPLOY CHOREOGRAPHY
            deployBtn.textContent = "🚀 Deploying Choreography...";

            const deployResponse = await fetch('http://localhost:3000/deploy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ solidityCode })
            });

            const result = await deployResponse.json();

            if (result.success) {
                deployBtn.textContent = "✅ Deployed";
                deployBtn.style.background = "#e8f5e9";

                // Capture Environment Gas (if deployed)
                const envGas = envResult ? envResult.totalGas : 0;
                const chorGas = result.gasUsed;
                const totalGas = Number(envGas) + Number(chorGas);

                alert(`🎉 Sistema Deployato!\n\n🌍 Environment: ${envAddress || "N/A"}\n📜 Choreography: ${result.contractAddress}\n\n⛽ Environment Cost: ${envGas}\n⛽ Choreography Cost: ${chorGas}\n💰 TOTAL GAS: ${totalGas}`);

                if (result.abi) {
                    initBlockchainInteraction(modeler, result.contractAddress, result.abi);
                }
            } else {
                throw new Error(result.error);
            }

        } catch (err) {
            console.error(err);
            deployBtn.textContent = "❌ Error";
            deployBtn.disabled = false;
            alert("Errore Processo: " + err.message);
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
            });

            // MAP ID TO NAMES FOR DEBUG
            const debugState = {};
            elements.forEach(el => {
                const registryEl = modeler.get('elementRegistry').get(el.ID);
                const name = registryEl ? (registryEl.businessObject.name || el.ID) : el.ID;
                debugState[name] = el.status;
            });
            console.log("--- POLLING STATE (NAMES) ---", debugState);

            elements.forEach(el => {
                const bpmnId = el.ID;
                const status = parseInt(el.status);

                // Gestione _response (colora il padre verde se attesa risposta)
                if (bpmnId.endsWith('_response')) {
                    const parentId = bpmnId.replace('_response', '');
                    if (status === 1) {
                        updateElementColor(canvas, parentId, 1); // ForzagGreen
                    }
                } else {
                    // Solo se non è stato già forzato da una response attiva
                    if (interactionState[bpmnId + '_response'] !== 1) {
                        updateElementColor(canvas, bpmnId, status);
                    }
                }
            });
        } catch (err) { }
    }, 1500);
}

function updateElementColor(canvas, elementId, status) {
    canvas.removeMarker(elementId, 'highlight-yellow');
    canvas.removeMarker(elementId, 'highlight-green');
    canvas.removeMarker(elementId, 'highlight-red');
    canvas.removeMarker(elementId, 'highlight-blue'); // Aggiungo marker blu per DONE

    // MAPPING STATO (Basato su enum Solidity: 0=DISABLED, 1=ENABLED, 2=DONE)
    if (status === 1) {
        // ENABLED -> Verde/Giallo (Attivo, cliccabile)
        canvas.addMarker(elementId, 'highlight-green');
    } else if (status === 2) {
        // DONE -> Rosso (Completato, come richiesto per l'End Event)
        // Nota: Questo colorerà di rosso anche i task completati con successo.
        // Se non piace, cambieremo questo in Blue o Grey.
        canvas.addMarker(elementId, 'highlight-red');
    }
    // STATUS 0 (DISABLED) -> Nessun marker (Bianco/Neutro)
    // Evita che tutto il diagramma diventi rosso all'inizio.
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
                const messageParams = extractMessageParams(element, false); // false = request
                showInputPopup(functionName, methodAbi, messageParams);
            }
        }
        else if (interactionState[elementId + '_response'] === 1) {
            const functionName = elementId.replace(/-/g, '_') + '_response';
            const methodAbi = abi.find(m => m.name === functionName && m.type === 'function');
            if (methodAbi) {
                const messageParams = extractMessageParams(element, true); // true = response
                showInputPopup(functionName, methodAbi, messageParams);
            }
        }
    });
}

function extractMessageParams(element, isResponse = false) {
    let params = [];
    if (element.type === 'bpmn:ChoreographyTask') {
        const bo = element.businessObject;
        if (bo.messageFlowRef && bo.messageFlowRef.length > 0) {

            // --- DEBUG LOG START ---
            console.log(`%c[DEBUG MSG PARAMS] Processing ${element.id}`, "color: orange; font-weight: bold;");
            console.log("Initiating Participant Ref:", bo.initiatingParticipantRef);
            console.log("Message Flows:", bo.messageFlowRef);
            // --- DEBUG LOG END ---

            // Logic based on Initiating Participant to be robust
            let messageFlow = null;
            const initPart = bo.initiatingParticipantRef;

            if (initPart) {
                // Use ID comparison for safety
                // initPart might be an object, we want its ID.
                const initPartId = initPart.id;

                if (isResponse) {
                    // Response: Source is NOT the initiating participant
                    messageFlow = bo.messageFlowRef.find(mf => mf.sourceRef && mf.sourceRef.id !== initPartId);
                    console.log(`[DEBUG] Looking for Response (Source != ${initPartId}). Found:`, messageFlow);
                } else {
                    // Request: Source IS the initiating participant
                    messageFlow = bo.messageFlowRef.find(mf => mf.sourceRef && mf.sourceRef.id === initPartId);
                    console.log(`[DEBUG] Looking for Request (Source == ${initPartId}). Found:`, messageFlow);
                }
            } else {
                console.warn("[DEBUG] No initiatingParticipantRef found on business object!");
            }

            // Fallback strategy if logic above failed or returned nothing
            if (!messageFlow) {
                console.warn("[DEBUG] Logic failed or no flow matches. Using fallback index strategy.");
                // If 2 messages, usually: 0=Request (Top), 1=Response (Bottom)
                // The previous code had 1=Request, 0=Response which caused the bug.
                let idx = 0;
                if (bo.messageFlowRef.length > 1) {
                    // FIX: Reverting to natural order based on user feedback
                    // Request (Top) -> Index 0
                    // Response (Bottom) -> Index 1
                    idx = isResponse ? 1 : 0;
                }
                messageFlow = bo.messageFlowRef[idx];
                console.log(`[DEBUG] Fallback selected index ${idx}:`, messageFlow);
            }

            if (messageFlow && messageFlow.messageRef) {
                const messageName = messageFlow.messageRef.name;
                console.log(`[DEBUG] Selected Message Name: ${messageName}`);

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
    // FORCE USE OF ABI INPUTS (Source of Truth)
    const paramsToRender = methodAbi.inputs;

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

            let field;
            // Check if this parameter refers to a location (by name)
            const isLocationField = param.name.toLowerCase().includes('location') ||
                param.name.toLowerCase().includes('site') ||
                param.name.toLowerCase().includes('place');

            const physicalPlaces = (typeof window.bpenvModeler?.getPhysicalPlaces === 'function')
                ? window.bpenvModeler.getPhysicalPlaces()
                : [];

            if (isLocationField && physicalPlaces.length > 0) {
                // RENDER SELECT (Dropdown) for locations
                field = document.createElement('select');
                field.style.width = "100%";
                field.style.padding = "8px";
                field.style.boxSizing = "border-box";
                field.style.border = "1px solid #ccc";
                field.style.borderRadius = "4px";

                // Add an empty or default option
                const defaultOpt = document.createElement('option');
                defaultOpt.value = "";
                defaultOpt.text = "-- Seleziona Luogo --";
                field.appendChild(defaultOpt);

                physicalPlaces.forEach(p => {
                    const opt = document.createElement('option');
                    opt.value = p.id;
                    opt.text = p.name ? `${p.name} (${p.id})` : p.id;
                    field.appendChild(opt);
                });
            } else if (param.type === 'bool') {
                field = document.createElement('select');
                field.style.width = "100%";
                field.style.padding = "8px";
                field.style.boxSizing = "border-box";
                field.style.border = "1px solid #ccc";
                field.style.borderRadius = "4px";

                const optTrue = document.createElement('option');
                optTrue.value = 'true';
                optTrue.text = 'true';
                field.appendChild(optTrue);

                const optFalse = document.createElement('option');
                optFalse.value = 'false';
                optFalse.text = 'false';
                field.appendChild(optFalse);
            } else {
                field = document.createElement('input');
                field.type = (param.type && param.type.includes('int')) ? 'number' : 'text';
                field.placeholder = `Inserisci ${param.name}`;
                field.style.width = "100%";
                field.style.padding = "8px";
                field.style.boxSizing = "border-box";
                field.style.border = "1px solid #ccc";
                field.style.borderRadius = "4px";
            }

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

    // Logic to handle location change (Zoom)
    const locationSelect = inputs.find(i => i.tagName === 'SELECT' && i.options[0]?.text === '-- Seleziona Luogo --');
    if (locationSelect) {
        locationSelect.onchange = (e) => {
            const placeId = e.target.value;
            if (placeId) {
                // 🗺️ OPTIONAL: Map Zoom/Focus
                if (typeof window.bpenvModeler?.focusPlace === 'function') {
                    window.bpenvModeler.focusPlace(placeId);
                } else {
                    console.log("Map focus requested for:", placeId);
                }
            }
        };
    }

    sendBtn.onclick = async () => {
        const args = inputs.map((input, index) => {
            const paramDef = paramsToRender[index];
            if (paramDef.type === 'bool') {
                return input.value === 'true';
            }
            return input.value;
        });
        try {
            sendBtn.innerText = "Invio in corso...";
            sendBtn.disabled = true;
            const accounts = await web3.eth.getAccounts();
            console.log("SENDING ARGS:", args); // DEBUG ARGS
            const receipt = await contractInstance.methods[functionName](...args).send({ from: accounts[0], gas: 6721975 });
            console.log(`⛽ Task Execution Gas: ${receipt.gasUsed}`);
            alert(`✅ Transazione inviata con successo!\n⛽ Gas Used: ${receipt.gasUsed}`);
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