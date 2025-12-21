const fs = require('fs');
const BpmnModdle = require('bpmn-moddle');

/**
 * Prende in input il percorso di un file XML BPMN e restituisce un oggetto parsed
 * con tasks, choreographyTasks, gateways, events, flows, participants, messages, messageFlows.
 */
async function parseBpmn(filePath) {
  try {
    // Legge il file XML
    const xml = fs.readFileSync(filePath, 'utf8');

    // Inizializza bpmn-moddle
    const moddle = new BpmnModdle();

    // Esegue il parsing del XML
    const { rootElement } = await moddle.fromXML(xml);

    // Cerca il processo o coreografia principale
    let process = null;
    const processes = rootElement.rootElements.filter(e =>
      e.$type === 'bpmn:Process' ||
      e.$type === 'bpmn:Choreography' ||
      e.$type.includes('Process') ||
      e.$type.includes('Choreography')
    );

    if (processes.length > 0) {
      process = processes[0];
    } else {
      // Cerca ricorsivamente in altri elementi di root
      for (const element of rootElement.rootElements) {
        if (element.flowElements && element.flowElements.length > 0) {
          process = element;
          break;
        }
      }
    }

    if (!process) {
      throw new Error('No BPMN process or choreography found');
    }



    const flowElements = process.flowElements || [];

    // 1. Parse ChoreographyTask
    const choreographyTasks = parseChoreographyTasks(flowElements);

    // 2. Parse Participants dal process (Choreography.participants)
    const participants = parseParticipants(process);


    // 3. Parse Messages e MessageFlows da root + collaborazione interna
    const { messages, messageFlows } = parseMessagesAndFlows(rootElement, process);



    // 4. Elementi base
    const tasks = flowElements
      .filter(e => e.$type === 'bpmn:Task' || e.$type === 'bpmn:ServiceTask')
      .map(task => ({ id: task.id, name: task.name || task.id, type: task.$type }));

    // 🔹 MIGLIORATO: Gateway con supporto default flow
    const gateways = parseGateways(flowElements);

    // FIX: Escludiamo i Gateway dalla lista degli eventi per evitare duplicati/sovrascritture
    const events = flowElements
      .filter(e => e.$type.includes('Event') && !e.$type.includes('Gateway'))
      .map(ev => ({ id: ev.id, name: ev.name || ev.id, type: ev.$type }));

    // 5. Sequence flow con condizioni
    const flows = parseSequenceFlows(flowElements);

    return {
      processName: process.name || process.id || 'Choreography',
      processType: process.$type,
      tasks,
      gateways,
      events,
      flows,
      choreographyTasks,
      participants,
      messages,
      messageFlows
    };

  } catch (error) {
    console.error('Error parsing BPMN:', error.message);
    throw error;
  }
}

// --- Funzioni Helper ---

// ChoreographyTask
function parseChoreographyTasks(flowElements) {
  const result = [];
  flowElements.forEach(el => {
    if (el.$type === 'bpmn:ChoreographyTask') {
      const task = {
        id: el.id,
        name: el.name || el.id,
        type: el.$type,
        initiatingParticipant: el.initiatingParticipantRef?.id || null,
        participants: el.participantRef?.map(r => r.id) || [],
        requestMessage: null,
        responseMessage: null
      };

      if (el.messageFlowRef) {
        // Logica robusta basata su initiatingParticipantRef per distinguere Request da Response
        const initPartId = el.initiatingParticipantRef?.id;

        el.messageFlowRef.forEach((m, i) => {
          let isRequest = false;

          if (initPartId && m.sourceRef) {
            // Se conosco chi inizia, la Request è quella che PARTE da lui
            if (m.sourceRef.id === initPartId) {
              isRequest = true;
            }
            // Altrimenti è Response (o messaggio successivo)
          } else {
            // Fallback se manca il riferimento al partecipante: usa l'ordine (ma corretto)
            // Solitamente: 0 = Request, 1 = Response.
            // Il codice legacy faceva affidamento su questo, ma a volte l'ordine è invertito nel XML?
            // Se siamo qui, manteniamo la vecchia logica di default o proviamo a indovinare.
            // Default: 0 -> Request.
            if (i === 0) isRequest = true;
          }

          if (isRequest) {
            task.requestMessage = m.id;
          } else {
            // Se ho già una response, non sovrascrivere (potrebbero esserci più messaggi?)
            // Per ora assumiamo max 1 Request e max 1 Response per Task.
            task.responseMessage = m.id;
          }
        });
      }

      result.push(task);
    }
  });
  return result;
}

// Participants dal process (per Choreography)
function parseParticipants(process) {
  const participants = [];
  if (process.$type === 'bpmn:Choreography' && process.participants) {
    process.participants.forEach(p => {
      participants.push({
        id: p.id,
        name: p.name || p.id,
        processRef: p.processRef?.id || null
      });
    });
  }
  return participants;
}

// Messages e MessageFlows
function parseMessagesAndFlows(rootElement, process) {
  const messages = [];
  const flows = [];

  // rootElement Messages
  rootElement.rootElements.forEach(el => {
    if (el.$type === 'bpmn:Message') {
      messages.push({ id: el.id, name: el.name || el.id, itemRef: el.itemRef?.id || null });
    }
  });

  // MessageFlows inside Collaboration or process
  const containers = rootElement.rootElements
    .filter(el => el.$type === 'bpmn:Collaboration');

  containers.forEach(coll => {
    coll.messageFlows?.forEach(mf => {
      flows.push({
        id: mf.id,
        name: mf.name || mf.id,
        sourceRef: mf.sourceRef?.id || null,
        targetRef: mf.targetRef?.id || null,
        messageRef: mf.messageRef?.id || null
      });
    });
  });

  // anche process.messageFlows se presente
  process.messageFlows?.forEach(mf => {
    flows.push({
      id: mf.id,
      name: mf.name || mf.id,
      sourceRef: mf.sourceRef?.id || null,
      targetRef: mf.targetRef?.id || null,
      messageRef: mf.messageRef?.id || null
    });
  });

  return { messages, messageFlows: flows };
}

// Parsing gateway migliorato con supporto default flow
function parseGateways(flowElements) {
  return flowElements
    .filter(e => e.$type.includes('Gateway'))
    .map(g => {


      return {
        id: g.id,
        name: g.name || g.id,
        type: g.$type,
        gatewayDirection: g.gatewayDirection,
        default: g.default?.id || g.default || null
      };
    });
}

// SequenceFlow con supporto condizioni dal NAME
function parseSequenceFlows(flowElements) {
  return flowElements
    .filter(e => e.$type === 'bpmn:SequenceFlow')
    .map(f => {
      // Recupera la condizione da conditionExpression O dal name
      let conditionExpression = null;

      // Metodo 1: conditionExpression standard
      if (f.conditionExpression) {
        conditionExpression = f.conditionExpression.body ||
          f.conditionExpression.$body ||
          f.conditionExpression.value ||
          f.conditionExpression.text ||
          (typeof f.conditionExpression === 'string' ? f.conditionExpression : JSON.stringify(f.conditionExpression));
      }
      // Metodo 2: Se non c'è conditionExpression, prova il name
      else if (f.name) {
        const name = f.name.trim();
        // Supporto per:
        // 1. Operatori di confronto: ==, !=, >, <, >=, <=
        // 2. Variabili booleane semplici: "isReady", "confirmed"
        // 3. Negazioni: "!isReady"
        // 4. Valori diretti: "true", "false"

        const hasOperator = /==|!=|>|<|>=|<=/.test(name);
        const isBoolean = /^!?[a-zA-Z_][a-zA-Z0-9_]*\??$/.test(name); // Es. "confirmed", "!confirmed", "ready?"
        const isValue = name === 'true' || name === 'false';

        if (hasOperator || isBoolean || isValue) {
          // Rimuovi eventuale '?' finale se presente (stile BPMN "Approved?")
          conditionExpression = name.replace(/\?$/, '');
        }
      }

      const flow = {
        id: f.id,
        name: f.name || null,
        sourceRef: f.sourceRef?.id || f.sourceRef || null,
        targetRef: f.targetRef?.id || f.targetRef || null,
        conditionExpression,
        isDefault: f.isDefault || false
      };



      return flow;
    });
}

module.exports = { parseBpmn };
