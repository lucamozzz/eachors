import bpenvModeler from 'bpenv-modeler';
import 'bpenv-modeler/dist/style.css';
import ChoreoModeler from './chor-js/lib/Modeler.js';
import PropertiesPanelModule from 'bpmn-js-properties-panel';
import Reporter from './lib/validator/Validator.js';
import PropertiesProviderModule from './lib/properties-provider/index.js';
// import CustomTokenAnimationControls from './chor-js/lib/features/token-animation/CustomTokenAnimationControls';
import xml from './diagrams/chor.bpmn';
import env from './diagrams/env.json';
import blank from './diagrams/blank.bpmn';
import messageTypeModdle from './chor-js/extension.json';
import TokenAnimationModule from './chor-js/lib/features/token-animation';
import { ethers, encodeBytes32String, decodeBytes32String } from 'ethers';
window.bpenvModeler = bpenvModeler;

let lastFile;
let isValidating = false;
let isDirty = false;

const modeler = new ChoreoModeler({
  container: '#canvas',
  propertiesPanel: {
    parent: '#properties-panel'
  },
  additionalModules: [
    PropertiesPanelModule,
    PropertiesProviderModule,
    TokenAnimationModule
  ],
  keyboard: {
    bindTo: document
  },
  moddleExtensions: {
    msg: messageTypeModdle
  }
});

const eventBus = modeler.get('eventBus');
eventBus.on('selection.changed', function (event) {
  const newlySelected = event.newSelection && event.newSelection[0];
  if (newlySelected && newlySelected.type === 'bpmn:Message') {
    // Il pannello delle proprietà si aggiorna già da solo su nuova selezione,
    // ma qui puoi forzare tab oppure mostrare il pannello se serve
    const propertiesPanelElement = document.getElementById('properties-panel');
    if (propertiesPanelElement) {
      propertiesPanelElement.classList.remove('hidden');
    }
  }
});

setInterval(() => {
  const selection = modeler.get('selection');
  const selected = selection.get();

  if (selected.length > 0) {
    selection.deselect(selected);
    selection.select(selected);
  }
}, 2000);

async function renderModel(newXml) {
  await modeler.importXML(newXml);
  isDirty = false;
}

function diagramName() {
  if (lastFile) {
    return lastFile.name;
  }
  return 'diagram.bpmn';
}

document.addEventListener('DOMContentLoaded', () => {
  const downloadLink = document.getElementById('js-download-diagram');
  downloadLink.addEventListener('click', async e => {
    const result = await modeler.saveXML({ format: true });
    downloadLink['href'] = 'data:application/bpmn20-xml;charset=UTF-8,' + encodeURIComponent(result.xml);
    downloadLink['download'] = diagramName();
    isDirty = false;
  });

  const downloadSvgLink = document.getElementById('js-download-svg');
  downloadSvgLink.addEventListener('click', async e => {
    const result = await modeler.saveSVG();
    downloadSvgLink['href'] = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(result.svg);
    downloadSvgLink['download'] = diagramName() + '.svg';
  });

  document.getElementById('js-open-file').addEventListener('click', e => {
    document.getElementById('file-input').click();
  });

  // toggle side panels
  const panels = Array.prototype.slice.call(
    document.getElementById('panel-toggle').children
  );
  panels.forEach(panel => {
    panel.addEventListener('click', () => {
      panels.forEach(otherPanel => {
        if (panel === otherPanel && !panel.classList.contains('active')) {
          // show clicked panel if it is not already active, otherwise hide it as well
          panel.classList.add('active');
          document.getElementById(panel.dataset.togglePanel).classList.remove('hidden');
        } else {
          // hide all other panels
          otherPanel.classList.remove('active');
          document.getElementById(otherPanel.dataset.togglePanel).classList.add('hidden');
        }
      });
    });
  });

  // create new diagram
  const newDiagram = document.getElementById('js-new-diagram');
  newDiagram.addEventListener('click', async e => {
    await renderModel(blank);
    lastFile = false;
  });

  // load diagram from disk
  const loadDiagram = document.getElementById('file-input');
  loadDiagram.addEventListener('change', e => {
    const file = loadDiagram.files[0];
    if (file) {
      const reader = new FileReader();
      lastFile = file;
      reader.addEventListener('load', async () => {
        await renderModel(reader.result);
        loadDiagram.value = null; // allows reloading the same file
      }, false);
      reader.readAsText(file);
    }
  });

  // drag & drop file
  const dropZone = document.body;
  dropZone.addEventListener('dragover', e => {
    e.preventDefault();
    dropZone.classList.add('is-dragover');
  });
  dropZone.addEventListener('dragleave', e => {
    e.preventDefault();
    dropZone.classList.remove('is-dragover');
  });
  dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('is-dragover');
    const file = e.dataTransfer.files[0];
    if (file) {
      const reader = new FileReader();
      lastFile = file;
      reader.addEventListener('load', () => {
        renderModel(reader.result);
      }, false);
      reader.readAsText(file);
    }
  });

  // validation logic and toggle
  const reporter = new Reporter(modeler);
  const validateButton = document.getElementById('js-validate');
  validateButton.addEventListener('click', e => {
    isValidating = !isValidating;
    if (isValidating) {
      reporter.validateDiagram();
      validateButton.classList.add('selected');
      validateButton['title'] = 'Disable checking';
    } else {
      reporter.clearAll();
      validateButton.classList.remove('selected');
      validateButton['title'] = 'Check diagram for problems';
    }
  });
  modeler.on('commandStack.changed', () => {
    if (isValidating) {
      reporter.validateDiagram();
    }
    isDirty = true;
  });
  modeler.on('import.render.complete', () => {
    if (isValidating) {
      reporter.validateDiagram();
    }

  });
});

// expose bpmnjs to window for debugging purposes
window.bpmnjs = modeler;

// Inizializza i controlli di animazione
let tokenAnimation;
modeler.on('import.render.complete', () => {
  // if (isValidating) {
  //   reporter.validateDiagram();
  // }

  // Inizializza i controlli di animazione dopo il rendering
  // if (animationControls) {
  //   animationControls.destroy();
  // }

  if (env)
    setTimeout(() => bpenvModeler.setModel(env), 500);

  try {
    tokenAnimation = modeler.get('customTokenAnimation');
    // animationControls = new CustomTokenAnimationControls(tokenAnimation, modeler.get('eventBus'), modeler);
  } catch (error) {
    console.warn('Token animation not available:', error);
  }
});

window.addEventListener('beforeunload', function (e) {
  if (isDirty) {
    // see https://developer.mozilla.org/en-US/docs/Web/API/WindowEventHandlers/onbeforeunload
    e.preventDefault();
    e.returnValue = '';
  }
});

const resizer = document.getElementById('resizer');
const left = document.getElementById('canvas');
const right = document.getElementById('bpenv-container');
const container = document.getElementById('split-container');

let x = 0;
let leftWidth = 0;

const onMouseMove = (e) => {
  const dx = e.clientX - x;
  const newLeftWidth = ((leftWidth + dx) * 100) / container.getBoundingClientRect().width;

  if (newLeftWidth < 10 || newLeftWidth > 90) return; // optional limit

  left.style.flexBasis = `${newLeftWidth}%`;
  right.style.flexBasis = `${100 - newLeftWidth}%`;
};

const onMouseUp = () => {
  document.removeEventListener('mousemove', onMouseMove);
  document.removeEventListener('mouseup', onMouseUp);
  document.body.style.cursor = 'default';
};

resizer.addEventListener('mousedown', (e) => {
  x = e.clientX;
  leftWidth = left.getBoundingClientRect().width;
  document.body.style.cursor = 'col-resize';

  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);
});

let chorContract;
let envContract;
document.getElementById('js-deploy').addEventListener('click', async () => {
  const icon = document.getElementById('deploy-icon');
  icon.style.display = 'none';
  const spinner = document.getElementById('deploy-spinner');
  spinner.style.display = 'block';

  try {
    const bpmnContent = await modeler.saveXML({ format: true });
    let envJson = await bpenvModeler.getModel();

    await ethereum.request({ method: 'eth_requestAccounts' });
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    const myAddress = await signer.getAddress();

    const res = await fetch('http://localhost:3000/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bpmnContent, envJson, myAddress })
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error);

    const {
      envAbi,
      envBytecode,
      chorAbi,
      chorBytecode
    } = data.payload;

    let env = await bpenvModeler.getModel();
    const EnvFactory = new ethers.ContractFactory(envAbi, envBytecode, signer);

    const envC = await EnvFactory.deploy(
      Array.from(new Set(env.physicalPlaces.flatMap(p => Object.keys(p.attributes))))
        .map(ethers.encodeBytes32String),
      env.physicalPlaces.map(p => ethers.encodeBytes32String(p.id)),
      env.edges.map(e => ethers.encodeBytes32String(e.source.split('_')[1] + '_' + e.target.split('_')[1])),
      env.logicalPlaces.map(lp => ethers.encodeBytes32String(lp.id)),
      env.logicalPlaces.map(lp => lp.conditions.map(c => `${c.attribute} ${c.operator} ${c.value}`).join(` ${lp.operator} `)),
      env.views.map(v => ethers.encodeBytes32String(v.id)),
      env.views.map(v => v.logicalPlaces.map(ethers.encodeBytes32String)),
      env.views.map(v => Object.keys(v.aggregations).map(ethers.encodeBytes32String)),
      env.views.map(v => Object.values(v.aggregations).map(ethers.encodeBytes32String))
    );

    await envC.waitForDeployment();
    console.log('Environment deployed at:', await envC.getAddress());
    bpenvModeler.setEditable(false);

    const ChorFactory = new ethers.ContractFactory(chorAbi, chorBytecode, signer);
    const chorC = await ChorFactory.deploy(await envC.getAddress());
    await chorC.waitForDeployment();
    console.log('Chor deployed at:', await chorC.getAddress());

    envContract = envC;
    chorContract = chorC;

    await fetch('http://localhost:3000/setContracts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        envAddress: await envC.getAddress(),
        envAbi,
        chorAddress: await chorC.getAddress(),
        chorAbi
      })
    });

    await fetchCurrentState();

  } catch (err) {
    console.error('Errore deploy:', err);
    alert('Errore deploy: ' + err.message);
  } finally {
    icon.style.display = 'block';
    spinner.style.display = 'none';
  }
});

const StateEnum = ['DISABLED', 'ENABLED', 'DONE'];
let currentState = [];
async function fetchCurrentState() {
  try {
    const [elements] = await chorContract.getCurrentState();
    currentState = elements.map(el => ({
      ID: el.ID,
      status: StateEnum[el.status]
    }));
    currentState.forEach(element => {
      if (!element || !element.ID) return;

      switch (element.status) {
      case 'DONE':
        tokenAnimation.colorElement(element.ID, 'green');
        break;
      case 'ENABLED':
        tokenAnimation.colorElement(element.ID, 'yellow');
        break;
      case 'DISABLED':
        tokenAnimation.colorElement(element.ID, 'red');
        break;
      }
    });
  } catch (err) {
    console.error(err);
  }
}

setInterval(async () => {
  if (envContract)
    await refreshPhysicalPlaces();
}, 5000);

async function getPhysicalPlaces(contract) {
  const [physicalPlaceKeys, attributeKeys, attributeValues] =
    await contract.getPhysicalPlaces();

  return physicalPlaceKeys.map((pk, i) => {
    const attrs = {};

    attributeKeys.forEach((key, j) => {
      const raw = attributeValues[i][j];
      if (raw !== ethers.encodeBytes32String(' ')) {
        attrs[ethers.decodeBytes32String(key)] =
          ethers.decodeBytes32String(raw);
      }
    });

    return {
      id: ethers.decodeBytes32String(pk),
      name: ethers.decodeBytes32String(pk),
      attributes: attrs
    };
  });
}

async function refreshPhysicalPlaces() {
  try {
    const updatedPlaces = await getPhysicalPlaces(envContract);
    console.log('Blockchain places:', updatedPlaces);

    let env = await bpenvModeler.getModel();

    // Mappa attuale dei places
    const oldPlaces = env.physicalPlaces;

    // Merge dei nuovi valori
    const merged = oldPlaces.map(old => {
      const updated = updatedPlaces.find(p => p.id === old.id);
      return updated ? { ...old, attributes: updated.attributes } : old;
    });

    env.physicalPlaces = merged;

    bpenvModeler.setModel(env);

  } catch (err) {
    console.error('Errore nella richiesta:', err);
  }
}

// async function getPhysicalPlaces(contract) {
//   const [physicalPlaceKeys, attributeKeys, attributeValues] =
//     await contract.getPhysicalPlaces();

//   return physicalPlaceKeys.map((pk, i) => {
//     const attrs = {};
//     for (let j = 0; j < attributeKeys.length; j++) {
//       const val = attributeValues[i][j];
//       if (val !== encodeBytes32String(' ')) {
//         attrs[decodeBytes32String(attributeKeys[j])] = decodeBytes32String(val);
//       }
//     }

//     return {
//       id: decodeBytes32String(pk),
//       name: decodeBytes32String(pk),
//       attributes: attrs,
//     };
//   });
// }

// async function refreshPhysicalPlaces() {
//   try {
//     const data = await getPhysicalPlaces(envContract);
//     console.log(data);

//     if (!data) {
//       console.error('Errore aggiornamento physicalPlaces:', data.error);
//       return;
//     }

//     const updatedPhysicalPlaces = data.map(oldPlace => {
//       const updated = data.find(p => p.id === oldPlace.id);
//       if (!updated) return oldPlace;
//       return {
//         ...oldPlace,
//         attributes: { ...updated.attributes }
//       };
//     });

//     let env = await bpenvModeler.getModel();

//     env.physicalPlaces = updatedPhysicalPlaces;
//     bpenvModeler.setModel({
//       'physicalPlaces': env.physicalPlaces,
//       'edges': env.edges,
//       'logicalPlaces': env.logicalPlaces,
//       'views': env.views
//     });

//   } catch (err) {
//     console.error('Errore nella richiesta:', err);
//   }
// }

async function callChorBackend(functionName, args = []) {
  try {
    const finalArgs = args.map(a => convertArg(a.type, a.value));
    const data = await chorContract[functionName](...finalArgs);
    console.log('Chor function result:', data);
  } catch (err) {
    console.error('Error calling Chor function:', err);
    throw err;
  }

  function convertArg(type, value) {
    switch (type) {
      case 'string':
        return value;

      case 'bytes32':
        return encodeBytes32String(value);

      case 'bytes32[]':
        return value.split(',').map(v => encodeBytes32String(v));

      case 'uint':
        return Number(value);

      default:
        throw new Error('Tipo non supportato: ' + type);
    }
  }
}

eventBus.on('element.click', function (e) {
  const element = e.element;
  if (element.type === 'bpmn:Message' || element.type === 'chor:Message') {
    const el = currentState.find(s => s.ID === element.id);
    if (!el) return;

    if (el.status === 'ENABLED') {
      showPopup(element, async (popupContainer) => {
        const inputs = popupContainer.querySelectorAll('input');
        const args = Array.from(inputs).map(input => ({
          name: input.dataset.param,
          type: input.dataset.type,
          value: input.value
        }));

        console.log('Calling chor function', element.id, args);
        await callChorBackend(element.id, args);
        setTimeout(async () => {
          console.log('Fetching state...');
          await fetchCurrentState();
        }, 5000);
      });
    }
  }
});


function showPopup(messageShape, onConfirm) {
  if (window._activePopup) {
    try { document.body.removeChild(window._activePopup); } catch (e) { }
    window._activePopup = null;
  }

  const popup = document.createElement('div');
  popup.className = 'token-popup';
  popup.style.position = 'fixed';
  popup.style.top = '50%';
  popup.style.left = '20%';
  popup.style.transform = 'translate(-50%, -50%)';
  popup.style.padding = '12px';
  popup.style.backgroundColor = 'white';
  popup.style.border = '1px solid #333';
  popup.style.zIndex = 1000;
  popup.style.minWidth = '250px';
  popup.style.maxWidth = '500px';
  popup.style.boxShadow = '0 4px 10px rgba(0,0,0,0.2)';

  const header = document.createElement('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';

  const title = document.createElement('div');
  title.innerText = messageShape.businessObject.name || 'Messaggio';
  title.style.fontWeight = '700';
  header.appendChild(title);

  const closeBtn = document.createElement('button');
  closeBtn.innerText = '✕';
  closeBtn.style.border = 'none';
  closeBtn.style.background = 'transparent';
  closeBtn.style.cursor = 'pointer';
  header.appendChild(closeBtn);

  popup.appendChild(header);

  const paramsContainer = document.createElement('div');
  paramsContainer.style.display = 'flex';
  paramsContainer.style.flexDirection = 'column';
  paramsContainer.style.gap = '5px';
  paramsContainer.style.marginTop = '10px';

  const signature = title.innerText;
  const paramsString = signature.match(/\((.*)\)/)?.[1];
  const params = paramsString ? paramsString.split(',').map(p => p.trim()) : [];

  params.forEach(param => {
    const [paramType, paramName] = param.split(' ');
    const label = document.createElement('label');
    label.innerText = paramName;

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = `${paramType}`;
    input.dataset.param = paramName;
    input.dataset.type = paramType;

    paramsContainer.appendChild(label);
    paramsContainer.appendChild(input);
  });

  popup.appendChild(paramsContainer);

  const actions = document.createElement('div');
  actions.style.display = 'flex';
  actions.style.justifyContent = 'flex-end';
  actions.style.marginTop = '12px';

  const okBtn = document.createElement('button');
  okBtn.innerText = 'OK';
  actions.appendChild(okBtn);
  popup.appendChild(actions);

  document.body.appendChild(popup);
  window._activePopup = popup;

  const cleanup = () => {
    if (window._activePopup) {
      try { document.body.removeChild(window._activePopup); } catch (e) { }
      window._activePopup = null;
    }
  };

  closeBtn.addEventListener('click', cleanup);
  okBtn.addEventListener('click', () => {
    if (onConfirm) onConfirm(popup);
    cleanup();
  });
}

bpenvModeler.render('bpenv-container');
renderModel(xml);
