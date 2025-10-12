// Rappresentazione avanzata di elementi BPMN con supporto per Choreography

class BpmnElement {
  constructor(id, name, type, outgoing = [], incoming = []) {
    this.id = id;
    this.name = name || id;
    this.type = type;
    this.outgoing = outgoing;
    this.incoming = incoming;
  }
}

// NUOVA CLASSE: ChoreographyTask
class ChoreographyTask extends BpmnElement {
  constructor(id, name, initiatingParticipant, participants = []) {
    super(id, name, 'bpmn:ChoreographyTask');
    this.initiatingParticipant = initiatingParticipant;
    this.participants = participants;
    this.requestMessage = null;
    this.responseMessage = null;
    this.taskType = 'ONEWAY'; // ONEWAY o TWOWAY
  }

  setMessages(requestMessage, responseMessage) {
    this.requestMessage = requestMessage;
    this.responseMessage = responseMessage;
    // Determina il tipo di task basato sui messaggi
    if (requestMessage && responseMessage) {
      this.taskType = 'TWOWAY';
    } else if (requestMessage || responseMessage) {
      this.taskType = 'ONEWAY';
    }
  }

  getInitiatingParticipant() {
    return this.initiatingParticipant;
  }

  getParticipants() {
    return this.participants;
  }

  isRequestResponse() {
    return this.taskType === 'TWOWAY';
  }
}

// NUOVA CLASSE: Gateway con supporto condizioni
class Gateway extends BpmnElement {
  constructor(id, name, type, gatewayDirection = 'Unspecified') {
    super(id, name, type);
    this.gatewayDirection = gatewayDirection;
    this.conditions = new Map(); // targetId -> condizione
    this.defaultFlow = null;  // 🔹 NUOVO: supporto default flow
  }

  addCondition(targetId, condition) {
    this.conditions.set(targetId, condition);
  }

  getCondition(targetId) {
    return this.conditions.get(targetId);
  }

  getAllConditions() {
    return this.conditions;
  }

  // 🔹 NUOVO: metodi per default flow
  setDefaultFlow(targetId) {
    this.defaultFlow = targetId;
  }

  getDefaultFlow() {
    return this.defaultFlow;
  }

  hasDefaultFlow() {
    return this.defaultFlow !== null;
  }

  isParallel() {
    return this.type === 'bpmn:ParallelGateway';
  }

  isExclusive() {
    return this.type === 'bpmn:ExclusiveGateway';
  }

  isEventBased() {
    return this.type === 'bpmn:EventBasedGateway';
  }

  isSplit() {
    return this.incoming.length === 1 && this.outgoing.length > 1;
  }

  isJoin() {
    return this.incoming.length > 1 && this.outgoing.length === 1;
  }
}

// NUOVA CLASSE: Participant
class Participant {
  constructor(id, name, processRef = null) {
    this.id = id;
    this.name = name;
    this.processRef = processRef;
  }
}

// NUOVA CLASSE: Message
class Message {
  constructor(id, name, parameters = []) {
    this.id = id;
    this.name = name;
    this.parameters = parameters; // Array di parametri estratti dal nome
  }

  // Estrae parametri dal nome del messaggio (es. "request(string date, uint people)")
  parseParameters() {
    if (!this.name) return [];
    const match = this.name.match(/\(([^)]*)\)/);
    if (!match) return [];
    const paramString = match[1].trim();
    if (!paramString) return [];
    return paramString.split(',').map(param => {
      const parts = param.trim().split(/\s+/);
      return {
        type: parts[0],
        name: parts[1]
      };
    });
  }
}

// NUOVA CLASSE: MessageFlow
class MessageFlow {
  constructor(id, name, sourceRef, targetRef, messageRef) {
    this.id = id;
    this.name = name;
    this.sourceRef = sourceRef;
    this.targetRef = targetRef;
    this.messageRef = messageRef;
  }
}

// CLASSE ESTESA: Modello intermedio complesso
class ChoreographyModel {
  constructor(parsed) {
    this.processName = parsed.processName;
    this.processType = parsed.processType;
    this.elements = new Map();
    this.participants = new Map();
    this.messages = new Map();
    this.messageFlows = new Map();
    this.roles = []; // Lista dei ruoli per i contratti
    this.stateVariables = new Set(); // Variabili di stato per StateMemory
    this.buildModel(parsed);
    this.analyzeModel();
  }

  buildModel(parsed) {
    // 1. Costruisci participants
    parsed.participants.forEach(p => {
      this.participants.set(p.id, new Participant(p.id, p.name, p.processRef));
    });

    // 2. Costruisci messages
    parsed.messages.forEach(m => {
      const message = new Message(m.id, m.name);
      message.parameters = message.parseParameters();
      this.messages.set(m.id, message);
    });

    // 3. Costruisci message flows
    parsed.messageFlows.forEach(mf => {
      this.messageFlows.set(mf.id, new MessageFlow(
        mf.id, mf.name, mf.sourceRef, mf.targetRef, mf.messageRef
      ));
    });

    // 4. Costruisci choreography tasks
    parsed.choreographyTasks.forEach(ct => {
      const task = new ChoreographyTask(
        ct.id,
        ct.name,
        ct.initiatingParticipant,
        ct.participants
      );

      // Collega i messaggi
      if (ct.requestMessage && this.messageFlows.has(ct.requestMessage)) {
        const reqFlow = this.messageFlows.get(ct.requestMessage);
        const reqMsg = this.messages.get(reqFlow.messageRef);
        task.requestMessage = reqMsg;
      }

      if (ct.responseMessage && this.messageFlows.has(ct.responseMessage)) {
        const resFlow = this.messageFlows.get(ct.responseMessage);
        const resMsg = this.messages.get(resFlow.messageRef);
        task.responseMessage = resMsg;
      }

      this.elements.set(ct.id, task);
    });

    // 🔹 MIGLIORATO: 5. Costruisci gateway con condizioni E default flow
    parsed.gateways.forEach(g => {
      const gateway = new Gateway(g.id, g.name, g.type, g.gatewayDirection);
      if (g.default) {
        gateway.setDefaultFlow(g.default);  // 🔹 Imposta default flow dal parsing
      }
      this.elements.set(g.id, gateway);
    });

    // 6. Altri elementi (task, eventi)
    [...parsed.tasks, ...parsed.events].forEach(e => {
      this.elements.set(e.id, new BpmnElement(e.id, e.name, e.type));
    });

    // 🔹 MIGLIORATO: 7. Collega flussi di sequenza e condizioni + default flow
    parsed.flows.forEach(f => {
      const source = this.elements.get(f.sourceRef);
      const target = this.elements.get(f.targetRef);
      
      if (source && target) {
        source.outgoing.push(f.targetRef);
        target.incoming.push(f.sourceRef);
        
        // Aggiungi condizioni ai gateway
        if (source instanceof Gateway) {
          if (f.conditionExpression) {
            source.addCondition(f.targetRef, f.conditionExpression);
            console.log(`🔗 Added condition to Gateway ${source.id}: ${f.targetRef} -> "${f.conditionExpression}"`);
          } else if (f.isDefault) {
            source.setDefaultFlow(f.targetRef);  // 🔹 Imposta default flow
            console.log(`🔗 Set default flow for Gateway ${source.id}: ${f.targetRef}`);
          }
        }
      }
    });

    // 🔹 NUOVO: Chiamata funzione debug
    this.debugGatewayConditions();
  }

  // 🔹 NUOVA: Funzione di debug per le condizioni dei gateway
  debugGatewayConditions() {
    console.log('\n=== 🚪 GATEWAY CONDITIONS DEBUG ===');
    this.getGateways().forEach(gateway => {
      console.log(`\n🚪 Gateway: ${gateway.id} (${gateway.type})`);
      console.log(`   Name: ${gateway.name || 'N/A'}`);
      console.log(`   Outgoing: [${gateway.outgoing.join(', ')}]`);
      console.log(`   Default Flow: ${gateway.getDefaultFlow() || 'N/A'}`);
      
      const conditions = gateway.getAllConditions();
      if (conditions.size > 0) {
        console.log('   🔍 Conditions:');
        conditions.forEach((condition, targetId) => {
          console.log(`     → ${targetId}: "${condition}"`);
        });
      } else {
        console.log('   ⚠️ No conditions found');
      }
    });
    console.log('=== END GATEWAY DEBUG ===\n');
  }

  analyzeModel() {
    // Estrai ruoli unici dai participants
    this.participants.forEach(participant => {
      if (participant.name && !this.roles.includes(participant.name)) {
        this.roles.push(participant.name);
      }
    });

    // Estrai variabili di stato dai parametri dei messaggi
    this.messages.forEach(message => {
      if (message.parameters) {
        message.parameters.forEach(param => {
          if (param.name) {
            this.stateVariables.add(param.name);
          }
        });
      }
    });
  }

  // Metodi di utilità per il generatore
  getChoreographyTasks() {
    return Array.from(this.elements.values())
      .filter(e => e instanceof ChoreographyTask);
  }

  getGateways() {
    return Array.from(this.elements.values())
      .filter(e => e instanceof Gateway);
  }

  getParticipantByName(name) {
    return Array.from(this.participants.values())
      .find(p => p.name === name);
  }

  getRoles() {
    return this.roles;
  }

  getStateVariables() {
    return Array.from(this.stateVariables);
  }

  getAllElements() {
    return Array.from(this.elements.values());
  }

  getElementById(id) {
    return this.elements.get(id);
  }
}

// Costruzione del modello intermedio da parsed data
function buildIntermediateModel(parsed) {
  return new ChoreographyModel(parsed);
}

module.exports = {
  BpmnElement,
  ChoreographyTask,
  Gateway,
  Participant,
  Message,
  MessageFlow,
  ChoreographyModel,
  buildIntermediateModel
};