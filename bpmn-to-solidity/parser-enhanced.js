// app/bpmn-to-solidity/parser-enhanced.cjs

// Carica bpmn-moddle compatibile sia con default export che CommonJS
let BpmnModdle = require('bpmn-moddle');
if (BpmnModdle && typeof BpmnModdle.default === 'function') {
  BpmnModdle = BpmnModdle.default;
}

if (typeof BpmnModdle !== 'function') {
  throw new Error('BpmnModdle constructor non trovato');
}
const { DOMParser } = require('xmldom');
/**
 * Prende in input una stringa XML BPMN e restituisce un oggetto parsed
 * con tasks, choreographyTasks, gateways, events, flows, participants, messages, messageFlows.
 */
async function parseBpmn(xmlString) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');
    
    // Log per debug
    console.log('XML parsed successfully, root:', doc.documentElement.tagName);
    
    // Parsing semplificato - estrai solo info basiche per testare
    const tasks = Array.from(doc.getElementsByTagName('*'))
      .filter(el => el.tagName.includes('choreographyTask'))
      .map(el => ({
        id: el.getAttribute('id') || 'unknown',
        name: el.getAttribute('name') || el.getAttribute('id') || 'unnamed',
        type: 'bpmn:ChoreographyTask'
      }));

    const participants = Array.from(doc.getElementsByTagName('*'))
      .filter(el => el.tagName.includes('participant'))
      .map(el => ({
        id: el.getAttribute('id') || 'unknown',
        name: el.getAttribute('name') || el.getAttribute('id') || 'unnamed'
      }));

    console.log(`Found ${tasks.length} tasks, ${participants.length} participants`);

    return {
      processName: 'SimpleChoreography',
      processType: 'bpmn:Choreography',
      tasks: [],
      gateways: [],
      events: [],
      flows: [],
      choreographyTasks: tasks,
      participants,
      messages: [],
      messageFlows: []
    };
  } catch (err) {
    console.error('Simple XML parsing failed:', err);
    throw err;
  }
}


// Helper di parsing

function parseChoreographyTasks(flowElements) {
  return flowElements
    .filter(e => e.$type === 'bpmn:ChoreographyTask')
    .map(el => {
      const task = {
        id: el.id,
        name: el.name || el.id,
        type: el.$type,
        initiatingParticipant: el.initiatingParticipantRef?.id || null,
        participants: el.participantRef?.map(r => r.id) || [],
        requestMessage: null,
        responseMessage: null
      };

      (el.messageFlowRef || []).forEach((m, i) => {
        if (i === 0) task.requestMessage = m.id;
        if (i === 1) task.responseMessage = m.id;
      });

      return task;
    });
}

function parseParticipants(process) {
  if (process.$type !== 'bpmn:Choreography') {
    return [];
  }
  return (process.participants || []).map(p => ({
    id: p.id,
    name: p.name || p.id,
    processRef: p.processRef?.id || null
  }));
}

function parseMessagesAndFlows(rootElement, process) {
  const messages     = [];
  const messageFlows = [];

  (rootElement.rootElements || []).forEach(el => {
    if (el.$type === 'bpmn:Message') {
      messages.push({
        id:   el.id,
        name: el.name || el.id,
        itemRef: el.itemRef?.id || null
      });
    }
  });

  (rootElement.rootElements || [])
    .filter(el => el.$type === 'bpmn:Collaboration')
    .forEach(coll => {
      (coll.messageFlows || []).forEach(mf => {
        messageFlows.push({
          id:         mf.id,
          name:       mf.name || mf.id,
          sourceRef:  mf.sourceRef?.id || null,
          targetRef:  mf.targetRef?.id || null,
          messageRef: mf.messageRef?.id || null
        });
      });
    });

  (process.messageFlows || []).forEach(mf => {
    messageFlows.push({
      id:         mf.id,
      name:       mf.name || mf.id,
      sourceRef:  mf.sourceRef?.id || null,
      targetRef:  mf.targetRef?.id || null,
      messageRef: mf.messageRef?.id || null
    });
  });

  return { messages, messageFlows };
}

function parseGateways(flowElements) {
  return flowElements
    .filter(e => e.$type.includes('Gateway'))
    .map(g => ({
      id:               g.id,
      name:             g.name || g.id,
      type:             g.$type,
      gatewayDirection: g.gatewayDirection,
      default:          g.default?.id || null
    }));
}

function parseSequenceFlows(flowElements) {
  return flowElements
    .filter(f => f.$type === 'bpmn:SequenceFlow')
    .map(f => {
      let conditionExpression = null;

      if (f.conditionExpression) {
        conditionExpression =
          f.conditionExpression.body ||
          f.conditionExpression.$body ||
          f.conditionExpression.value ||
          f.conditionExpression.text ||
          (typeof f.conditionExpression === 'string'
            ? f.conditionExpression
            : JSON.stringify(f.conditionExpression));
      } else if (f.name && /[<>=!]/.test(f.name)) {
        conditionExpression = f.name;
      }

      return {
        id:                  f.id,
        name:                f.name || null,
        sourceRef:           f.sourceRef?.id || null,
        targetRef:           f.targetRef?.id || null,
        conditionExpression,
        isDefault:           f.isDefault || false
      };
    });
}

module.exports = { parseBpmn };
