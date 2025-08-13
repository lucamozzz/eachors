import bpenvModeler from 'bpenv-modeler';
import 'bpenv-modeler/dist/style.css';
import ChoreoModeler from './chor-js/lib/Modeler';
import PropertiesPanelModule from 'bpmn-js-properties-panel';

import Reporter from './lib/validator/Validator.js';
import PropertiesProviderModule from './lib/properties-provider';
import TokenAnimationModule from './chor-js/lib/features/token-animation';
import CustomTokenAnimationControls from './chor-js/lib/features/token-animation/CustomTokenAnimationControls';

import xml from './diagrams/pizzaDelivery.bpmn';
import blankXml from './diagrams/newDiagram.bpmn';

let lastFile;
let isValidating = false;
let isDirty = false;

// create and configure a chor-js instance
const modeler = new ChoreoModeler({
  container: '#canvas',
  propertiesPanel: {
    parent: '#properties-panel'
  },
  // remove the properties' panel if you use the Viewer
  // or NavigatedViewer modules of chor-js
  additionalModules: [
    PropertiesPanelModule,
    PropertiesProviderModule,
    TokenAnimationModule
  ],
  keyboard: {
    bindTo: document
  }
});

// display the given model (XML representation)
async function renderModel(newXml) {
  await modeler.importXML(newXml);
  isDirty = false;
}

// returns the file name of the diagram currently being displayed
function diagramName() {
  if (lastFile) {
    return lastFile.name;
  }
  return 'diagram.bpmn';
}

document.addEventListener('DOMContentLoaded', () => {
  // download diagram as XML
  const downloadLink = document.getElementById('js-download-diagram');
  downloadLink.addEventListener('click', async e => {
    const result = await modeler.saveXML({ format: true });
    downloadLink['href'] = 'data:application/bpmn20-xml;charset=UTF-8,' + encodeURIComponent(result.xml);
    downloadLink['download'] = diagramName();
    isDirty = false;
  });

  // download diagram as SVG
  const downloadSvgLink = document.getElementById('js-download-svg');
  downloadSvgLink.addEventListener('click', async e => {
    const result = await modeler.saveSVG();
    downloadSvgLink['href'] = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(result.svg);
    downloadSvgLink['download'] = diagramName() + '.svg';
  });

  // open file dialog
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
    await renderModel(blankXml);
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
    function aggiornaSelectElementIds() {
  const select = document.getElementById('elementId');
  const elementRegistry = modeler.get('elementRegistry');

  // Pulisce la select prima di inserire nuovi elementi
  select.innerHTML = '';

  // Cicla su tutti gli elementi nel modeler e aggiunge un option per ognuno
  elementRegistry.getAll().forEach(el => {
    const option = document.createElement('option');
    option.value = el.id;
    option.textContent = `${el.id} (${el.type})`;
    select.appendChild(option);
  });
}

// Chiama la funzione quando il modello è stato caricato/renderizzato
modeler.on('import.render.complete', () => {
  aggiornaSelectElementIds();
});

  });
});

// expose bpmnjs to window for debugging purposes
window.bpmnjs = modeler;

// Inizializza i controlli di animazione
let animationControls;
modeler.on('import.render.complete', () => {
  if (isValidating) {
    reporter.validateDiagram();
  }
  
  // Inizializza i controlli di animazione dopo il rendering
  if (animationControls) {
    animationControls.destroy();
  }
  
  try {
    const tokenAnimation = modeler.get('customTokenAnimation');
    animationControls = new CustomTokenAnimationControls(tokenAnimation, modeler.get('eventBus'));
  } catch (error) {
    console.warn('Token animation not available:', error);
  }
});

window.addEventListener('beforeunload', function(e) {
  if (isDirty) {
    // see https://developer.mozilla.org/en-US/docs/Web/API/WindowEventHandlers/onbeforeunload
    e.preventDefault( );
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

modeler.on('import.render.complete', () => {
  // codice già presente per inizializzare i controlli di animazione
  try {
    const tokenAnimation = modeler.get('customTokenAnimation');
    animationControls = new CustomTokenAnimationControls(tokenAnimation, modeler.get('eventBus'));

    // Qui aggiungi il riferimento al servizio overlays
    const overlays = modeler.get('overlays');
    tokenAnimation._overlays = overlays;

    // Espone la funzione colorElement globalmente (se già non fatto)
    window.colorElement = (elementId, color) => tokenAnimation.colorElement(elementId, color);
    
    // Espone la funzione animateEdge globalmente
    window.animateEdge = tokenAnimation.animateEdge.bind(tokenAnimation);


  } catch (error) {
    console.warn('Token animation not available:', error);
  }
});




function aggiornaSelectElementIds() {
  const select = document.getElementById('elementId');
  const elementRegistry = modeler.get('elementRegistry');
  select.innerHTML = '';

  elementRegistry.getAll().forEach(element => {
    // Considera solo elementi disegnati come SHAPE (non connection)
    const isShape = !!element.x && !!element.y;
    // Verifica che l'elemento abbia un nodo grafico SVG (quindi è visibile)
    const hasGraphics = !!elementRegistry.getGraphics(element);

    if (
      isShape &&
      hasGraphics &&
      (
        element.type === 'bpmn:Message' ||
        element.type === 'bpmn:ExclusiveGateway' ||
        element.type === 'bpmn:ParallelGateway' ||
        element.type === 'bpmn:InclusiveGateway' ||
        element.type === 'bpmn:EventBasedGateway' ||
        element.type === 'bpmn:StartEvent' ||
        element.type === 'bpmn:EndEvent'
      )
    ) {
      const option = document.createElement('option');
      option.value = element.id;
      option.text = element.businessObject.name || element.id;
      select.appendChild(option);
    }
  });
}



// Chiama la funzione ogni volta che il diagramma viene caricato/renderizzato
modeler.on('import.render.complete', () => {
  aggiornaSelectElementIds();
});
modeler.on('commandStack.changed', () => {
  aggiornaSelectElementIds();
});

function aggiornaSelectEdgeIds() {
  const select = document.getElementById('edgeId');
  if (!select) return;
  const elementRegistry = window.bpmnjs.get('elementRegistry');
  select.innerHTML = '';
  elementRegistry.getAll().forEach(element => {
    if (element.type === 'bpmn:SequenceFlow') {
      const option = document.createElement('option');
      option.value = element.id;
      option.text = element.businessObject.name || element.id;
      select.appendChild(option);
    }
  });
}



modeler.on('import.render.complete', () => {
  aggiornaSelectEdgeIds();
});
modeler.on('commandStack.changed', () => {
  aggiornaSelectEdgeIds();
});
bpenvModeler.render('bpenv-container');

renderModel(xml);
