const { ChoreographyTask, Gateway } = require('./model-enhanced.js');

// Generatore dinamico di contratti Solidity
class SolidityGenerator {
  constructor(model) {
    this.model = model;
    this.elementCounter = 0;
    this.elementIndexMap = new Map(); // id -> index nel array elements
    this.buildElementIndexes();
  }

  buildElementIndexes() {
    this.model.getAllElements().forEach((element, index) => {
      this.elementIndexMap.set(element.id, index);
    });
  }

  generate() {
    let result = '';
    // Header del contratto
    result += this.generateHeader();
    // Eventi e strutture
    result += this.generateStructures();
    // Arrays e mappings
    result += this.generateArraysAndMappings();
    // Costruttore
    result += this.generateConstructor();
    // Modificatori
    result += this.generateModifiers();
    // Funzioni di inizializzazione
    result += this.generateInitFunction();
    // Funzioni utility (getRoles, subscribe, etc.)
    result += this.generateUtilityFunctions();
    // FUNZIONI DINAMICHE - Il cuore del generatore
    result += this.generateDynamicFunctions();
    // Funzioni helper
    result += this.generateHelperFunctions();
    result += '}\n';
    return result;
  }

  generateHeader() {
    return `// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;


contract ${this.model.processName} {
`;
  }

  generateStructures() {
    let result = `  event functionDone(string);
  mapping(string => uint) position;

  enum State { DISABLED, ENABLED, DONE }
  State s;
  mapping(string => string) operator;

  struct Element {
    string ID;
    State status;
  }

  struct StateMemory {
`;
    const stateVars = this.collectConditionVariables();
    if (stateVars.length === 0) {
      result += `    uint defaultValue;\n`;
    } else {
      stateVars.forEach(varName => {
        const type = this.inferSolidityType(varName);
        result += `    ${type} ${varName};\n`;
      });
    }
    result += `  }\n\n`;
    return result;
  }

  generateArraysAndMappings() {
    const allElements = this.model.getAllElements();
    let result = `  Element[] elements;
  StateMemory currentMemory;
  string[] elementsID = [`;
    // Genera lista dinamica degli ID
    allElements.forEach((element, index) => {
      result += `"${element.id}"`;
      if (index < allElements.length - 1) result += ', ';
    });
    result += `];

  string[] roleList = [`;
    // Genera lista dinamica dei ruoli
    const roles = this.model.getRoles();
    roles.forEach((role, index) => {
      result += `"${role}"`;
      if (index < roles.length - 1) result += ', ';
    });
    result += `];
  string[] optionalList = [""];

  mapping(string => address payable) roles;
  mapping(string => address payable) optionalRoles;

`;
    return result;
  }

  generateConstructor() {
    const roles = this.model.getRoles();
    let result = `  constructor() {
    // Struct instantiation
    for (uint i = 0; i < elementsID.length; i++) {
      elements.push(Element(elementsID[i], State.DISABLED));
      position[elementsID[i]] = i;
    }

    // Roles definition
`;
    roles.forEach(role => {
  result += `    roles["${role}"] = payable(0x7A224d367EB99e849dC80F3d7b9FAC9E03Fe8Be0);\n`;
      });

    result += `
    // Enable the start process
    init();
  }

`;
    return result;
  }

  generateModifiers() {
    return `  modifier checkMand(string memory role) {
    require(msg.sender == roles[role]);
    _;
  }

  modifier checkOpt(string memory role) {
    require(msg.sender == optionalRoles[role]);
    _;
  }

  modifier Owner(string memory task) {
    require(elements[position[task]].status == State.ENABLED);
    _;
  }

`;
  }

  generateInitFunction() {
    // Trova lo StartEvent per inizializzare
    const startEvent = this.model.getAllElements()
      .find(e => e.type === 'bpmn:StartEvent');
    const startEventId = startEvent ? startEvent.id : 'StartEvent_1jtgn3j';
    return `  function init() internal {
    bool result = true;
    for(uint i = 0; i < roleList.length; i++) {
      if(roles[roleList[i]] == 0x0000000000000000000000000000000000000000) {
        result = false;
        break;
      }
    }
    if(result) {
      enable("${startEventId}");
      ${this.parseSid(startEventId)}();
    }
    emit functionDone("Contract creation");
  }

`;
  }

  generateUtilityFunctions() {
    return `  function getRoles() public view returns(string[] memory, address[] memory) {
    uint c = roleList.length;
    string[] memory allRoles = new string[](c);
    address[] memory allAddresses = new address[](c);
    for(uint i = 0; i < roleList.length; i++) {
      allRoles[i] = roleList[i];
      allAddresses[i] = roles[roleList[i]];
    }
    return (allRoles, allAddresses);
  }

  function subscribe_as_participant(string memory _role) public {
    if(optionalRoles[_role] == 0x0000000000000000000000000000000000000000) {
      optionalRoles[_role] = payable(msg.sender);
    }
  }

 receive() external payable {
  }

`;
  }

  // FUNZIONE CHIAVE: Genera tutte le funzioni dinamicamente
  generateDynamicFunctions() {
    let result = '';
    this.model.getAllElements().forEach(element => {
      if (element instanceof ChoreographyTask) {
        result += this.generateChoreographyTaskFunction(element);
      } else if (element instanceof Gateway) {
        result += this.generateGatewayFunction(element);
      } else if (element.type === 'bpmn:StartEvent') {
        result += this.generateStartEventFunction(element);
      } else if (element.type === 'bpmn:EndEvent') {
        result += this.generateEndEventFunction(element);
      }
    });
    return result;
  }

  generateChoreographyTaskFunction(task) {
    let result = '';
    // Se il task ha sia request che response, genera due funzioni
    if (task.requestMessage && task.responseMessage) {
      result += this.generateRequestFunction(task);
      result += this.generateResponseFunction(task);
    }
    // Se ha solo request o response, genera una funzione
    else if (task.requestMessage) {
      result += this.generateRequestFunction(task);
    } else if (task.responseMessage) {
      result += this.generateResponseFunction(task);
    }
    return result;
  }

  generateRequestFunction(task) {
    const message = task.requestMessage;
    const participant = this.getParticipantRole(task.initiatingParticipant);
    const parameters = this.generateParameterString(message);
    const isPayable = message && message.name && message.name.includes('payment');
    let payableParam = '';
    if (isPayable) {
      payableParam = `${participant.toLowerCase()}_addr`;
    }

    let result = `
  function ${this.parseSid(task.id)}(${parameters}${isPayable ? (parameters ? ', ' : '') + 'address payable ' + payableParam : ''}) public${isPayable ? ' payable' : ''} checkMand(roleList[${this.getRoleIndex(participant)}]) {
    require(elements[position["${task.id}"]].status == State.ENABLED);
    done("${task.id}");
`;

    // Aggiorna state memory
    if (message && message.parameters) {
      message.parameters.forEach(param => {
        result += `    currentMemory.${param.name} = ${param.name};\n`;
      });
    }

    // Gestisci pagamenti
    if (isPayable) {
      result += `    currentMemory.payable = ${payableParam};\n`;
      const targetRole = this.getOtherParticipant(task, participant);
      result += `    roles["${targetRole}"].transfer(msg.value);\n`;
    }

    // Abilita prossimi elementi
    result += this.generateNextElementEnabling(task);
    result += '  }\n';
    return result;
  }

  generateResponseFunction(task) {
    const message = task.responseMessage;
    const participant = this.getParticipantRole(task.participants.find(p => p !== task.initiatingParticipant));
    const parameters = this.generateParameterString(message);

    let result = `
  function ${this.parseSid(task.id)}_response(${parameters}) public checkMand(roleList[${this.getRoleIndex(participant)}]) {
    require(elements[position["${task.id}_response"]].status == State.ENABLED);
    done("${task.id}_response");
`;

    // Aggiorna state memory
    if (message && message.parameters) {
      message.parameters.forEach(param => {
        result += `    currentMemory.${param.name} = ${param.name};\n`;
      });
    }

    // Abilita prossimi elementi
    result += this.generateNextElementEnabling(task);
    result += '  }\n';
    return result;
  }

  generateGatewayFunction(gateway) {
    if (gateway.isExclusive()) {
      return this.generateExclusiveGatewayFunction(gateway);
    } else if (gateway.isParallel()) {
      return this.generateParallelGatewayFunction(gateway);
    } else if (gateway.isEventBased()) {
      return this.generateEventBasedGatewayFunction(gateway);
    } else if (gateway.type === 'bpmn:InclusiveGateway') {
      return this.generateInclusiveGatewayFunction(gateway);
    }
    return '';
  }

  // 🔹 CORRETTO: Generatore XOR con gestione condizioni e default
  generateExclusiveGatewayFunction(gateway) {
    let result = `
  // ----- Exclusive Gateway: ${gateway.id} -----`;
    if (gateway.name && gateway.name !== gateway.id) {
      result += `\n  // Name: ${gateway.name}`;
    }
    result += `
  function ${this.parseSid(gateway.id)}() private {
    require(elements[position["${gateway.id}"]].status == State.ENABLED);
    done("${gateway.id}");
`;

    const conditions = Array.from(gateway.getAllConditions().entries());
    const defaultFlow = gateway.getDefaultFlow();

    console.log(`🔍 Generating XOR ${gateway.id}:`, {
      conditions: conditions.length,
      defaultFlow,
      outgoing: gateway.outgoing
    });

    if (conditions.length > 0) {
      // Genera condizioni if-else
      conditions.forEach(([targetId, condition], index) => {
        const condCode = this.translateCondition(condition);
        const ifStatement = index === 0 ? `    if (${condCode}) {\n` : `    } else if (${condCode}) {\n`;
        
        result += ifStatement;
        result += `      enable("${targetId}");\n`;
        
        const next = this.model.getElementById(targetId);
        if (next instanceof Gateway) {
          result += `      ${this.parseSid(targetId)}();\n`;
        }
      });

      // Gestione default flow
      if (defaultFlow) {
        result += `    } else {\n`;
        result += `      // Default flow\n`;
        result += `      enable("${defaultFlow}");\n`;
        
        const next = this.model.getElementById(defaultFlow);
        if (next instanceof Gateway) {
          result += `      ${this.parseSid(defaultFlow)}();\n`;
        }
        result += `    }\n`;
      } else {
        result += `    } else {\n`;
        result += `      // ⚠️ No default flow defined for this XOR\n`;
        result += `      revert("No valid condition met in XOR gateway ${gateway.id}");\n`;
        result += `    }\n`;
      }
    } else if (gateway.outgoing.length > 0) {
      // 🔹 NUOVO: Se non ci sono condizioni, abilita tutti i flussi di uscita (comportamento di default per XOR senza condizioni)
      result += `    // No conditions found - enabling all outgoing flows\n`;
      
      if (defaultFlow) {
        // Se c'è un default flow, usalo
        result += `    // Using default flow\n`;
        result += `    enable("${defaultFlow}");\n`;
        const next = this.model.getElementById(defaultFlow);
        if (next instanceof Gateway) {
          result += `    ${this.parseSid(defaultFlow)}();\n`;
        }
      } else {
        // Altrimenti, usa il primo outgoing come default
        const firstTarget = gateway.outgoing[0];
        result += `    // Using first outgoing as default\n`;
        result += `    enable("${firstTarget}");\n`;
        const next = this.model.getElementById(firstTarget);
        if (next instanceof Gateway) {
          result += `    ${this.parseSid(firstTarget)}();\n`;
        }
      }
    } else {
      result += `    // ⚠️ No outgoing flows found\n`;
    }

    result += `  }\n  // ----- End Exclusive Gateway: ${gateway.id} -----\n`;
    return result;
  }

  generateParallelGatewayFunction(gateway) {
    let result = `
  function ${this.parseSid(gateway.id)}() private {
    require(elements[position["${gateway.id}"]].status == State.ENABLED);
    done("${gateway.id}");
`;

    if (gateway.isSplit()) {
      // Parallel Split: abilita tutti gli elementi in uscita
      gateway.outgoing.forEach(targetId => {
        result += `    enable("${targetId}");\n`;
        const next = this.model.getElementById(targetId);
        if (next && next instanceof Gateway) {
          result += `    ${this.parseSid(targetId)}();\n`;
        }
      });
    } else if (gateway.isJoin()) {
      // Parallel Join: attende che tutti gli incoming siano completati
      gateway.incoming.forEach(sourceId => {
        result += `    require(elements[position["${sourceId}"]].status == State.DONE);\n`;
      });
      if (gateway.outgoing.length > 0) {
        const targetId = gateway.outgoing[0];
        result += `    enable("${targetId}");\n`;
        const next = this.model.getElementById(targetId);
        if (next && next instanceof Gateway) {
          result += `    ${this.parseSid(targetId)}();\n`;
        }
      }
    }

    result += '  }\n';
    return result;
  }

  generateEventBasedGatewayFunction(gateway) {
    let result = `
  function ${this.parseSid(gateway.id)}() private {
    require(elements[position["${gateway.id}"]].status == State.ENABLED);
    done("${gateway.id}");
`;

    // 🔹 CORRETTO: Per EventBasedGateway, abilita tutti i target
    gateway.outgoing.forEach(targetId => {
      result += `    enable("${targetId}");\n`;
    });

    result += '  }\n';
    return result;
  }

  generateInclusiveGatewayFunction(gateway) {
    let result = `
  function ${this.parseSid(gateway.id)}() private {
    require(elements[position["${gateway.id}"]].status == State.ENABLED);
    done("${gateway.id}");
`;

    if (gateway.isSplit()) {
      // Inclusive Split: abilita i flussi le cui condizioni sono vere
      gateway.outgoing.forEach(targetId => {
        const condition = gateway.getCondition(targetId);
        if (condition) {
          const conditionCode = this.translateCondition(condition);
          result += `    if (${conditionCode}) {\n`;
          result += `      enable("${targetId}");\n`;
          const next = this.model.getElementById(targetId);
          if (next && next instanceof Gateway) {
            result += `      ${this.parseSid(targetId)}();\n`;
          }
          result += `    }\n`;
        } else {
          // se non c'è condizione, considerala sempre vera
          result += `    enable("${targetId}");\n`;
        }
      });
    } else if (gateway.isJoin()) {
      // Inclusive Join: attende che tutti gli incoming siano completati
      gateway.incoming.forEach(sourceId => {
        result += `    require(elements[position["${sourceId}"]].status == State.DONE);\n`;
      });
      if (gateway.outgoing.length > 0) {
        const targetId = gateway.outgoing[0];
        result += `    enable("${targetId}");\n`;
        const next = this.model.getElementById(targetId);
        if (next && next instanceof Gateway) {
          result += `    ${this.parseSid(targetId)}();\n`;
        }
      }
    }

    result += '  }\n';
    return result;
  }

  generateStartEventFunction(event) {
    return `
  function ${this.parseSid(event.id)}() private {
    require(elements[position["${event.id}"]].status == State.ENABLED);
    done("${event.id}");
${this.generateNextElementEnabling(event)}
  }

`;
  }

  generateEndEventFunction(event) {
    return `
  function ${this.parseSid(event.id)}() private {
    require(elements[position["${event.id}"]].status == State.ENABLED);
    done("${event.id}");
  }

`;
  }

  // 🔹 Nuovo metodo da aggiungere alla classe SolidityGenerator
  collectConditionVariables() {
    const stateVars = new Set(this.model.getStateVariables());
    this.model.getGateways().forEach(gateway => {
      gateway.getAllConditions().forEach((condition, targetId) => {
        const matches = condition.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g);
        if (matches) {
          matches.forEach(v => {
            if (!stateVars.has(v) && v !== 'true' && v !== 'false') {
              stateVars.add(v);
            }
          });
        }
      });
    });
    // Include variabili dai messaggi di risposta
    this.model.getAllElements().forEach(el => {
      if (el instanceof ChoreographyTask) {
        [el.requestMessage, el.responseMessage].forEach(msg => {
          if (msg && msg.parameters) {
            msg.parameters.forEach(p => stateVars.add(p.name));
          }
        });
      }
    });
    return Array.from(stateVars);
  }

  // FUNZIONI HELPER
  generateNextElementEnabling(element) {
    let result = '';
    element.outgoing.forEach(targetId => {
      result += `    enable("${targetId}");\n`;
      const nextElement = this.model.getElementById(targetId);
      if (nextElement instanceof Gateway) {
        result += `    ${this.parseSid(targetId)}();\n`;
      }
    });
    return result;
  }

  generateParameterString(message) {
    if (!message || !message.parameters || message.parameters.length === 0) {
      return '';
    }
    return message.parameters.map(param =>
      `${this.mapToSolidityType(param.type)} ${param.name}`
    ).join(', ');
  }

  // 🔹 MIGLIORATO: Traduzione condizioni più robusta
  translateCondition(condition) {
    if (!condition || condition === 'true') return 'true';
    if (condition === 'false') return 'false';
    
    // Gestisci espressioni comuni BPMN
    if (condition.includes('==')) {
      const [variable, value] = condition.split('==').map(s => s.trim());
      if (this.isStringValue(value)) {
        return `compareStrings(currentMemory.${variable}, ${value})`;
      } else {
        return `currentMemory.${variable} == ${value}`;
      }
    } else if (condition.includes('!=')) {
      const [variable, value] = condition.split('!=').map(s => s.trim());
      if (this.isStringValue(value)) {
        return `!compareStrings(currentMemory.${variable}, ${value})`;
      } else {
        return `currentMemory.${variable} != ${value}`;
      }
    } else if (condition.includes('>=')) {
      const [variable, value] = condition.split('>=').map(s => s.trim());
      return `currentMemory.${variable} >= ${value}`;
    } else if (condition.includes('<=')) {
      const [variable, value] = condition.split('<=').map(s => s.trim());
      return `currentMemory.${variable} <= ${value}`;
    } else if (condition.includes('>')) {
      const [variable, value] = condition.split('>').map(s => s.trim());
      return `currentMemory.${variable} > ${value}`;
    } else if (condition.includes('<')) {
      const [variable, value] = condition.split('<').map(s => s.trim());
      return `currentMemory.${variable} < ${value}`;
    }
    
    // Se è solo una variabile, considera come boolean
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(condition.trim())) {
      return `currentMemory.${condition.trim()}`;
    }
    
    // Fallback: usa la condizione as-is con currentMemory prefix
    return condition.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g, 'currentMemory.$1');
  }

  generateHelperFunctions() {
    return `
  function enable(string memory _taskID) internal {
    elements[position[_taskID]].status = State.ENABLED;
  }

  function disable(string memory _taskID) internal {
    elements[position[_taskID]].status = State.DISABLED;
  }

  function done(string memory _taskID) internal {
    elements[position[_taskID]].status = State.DONE;
    emit functionDone(_taskID);
  }

  function getCurrentState() public view returns(Element[] memory, StateMemory memory) {
    return (elements, currentMemory);
  }

  function compareStrings(string memory a, string memory b) internal pure returns (bool) {
    return keccak256(abi.encode(a)) == keccak256(abi.encode(b));
  }

`;
  }

  // UTILITY METHODS
  parseSid(sid) {
    return sid.replace(/-/g, '_');
  }

  getParticipantRole(participantId) {
    const participant = this.model.participants.get(participantId);
    return participant ? participant.name : 'Client';
  }

  getRoleIndex(roleName) {
    const roles = this.model.getRoles();
    return roles.indexOf(roleName);
  }

  getOtherParticipant(task, currentParticipant) {
    return task.participants.find(p =>
      this.getParticipantRole(p) !== currentParticipant
    ) || 'Hotel';
  }

  inferSolidityType(varName) {
    if (varName.includes('date') || varName.includes('id') || varName.includes('motivation')) {
      return 'string';
    } else if (varName.includes('confirm') || varName.includes('confirmation') || varName.includes('cancel')) {
      return 'bool';
    } else if (varName.includes('number') || varName.includes('people') || varName.includes('quotation') || varName.includes('bedrooms')) {
      return 'uint';
    }
    return 'string'; // default
  }

  mapToSolidityType(bpmnType) {
    const typeMap = {
      'string': 'string memory',
      'uint': 'uint',
      'bool': 'bool',
      'address': 'address'
    };
    return typeMap[bpmnType] || 'string memory';
  }

  isStringValue(value) {
    return value.startsWith('"') && value.endsWith('"');
  }
}

// Funzione principale che genera il contratto
function generateSolidity(model) {
  const generator = new SolidityGenerator(model);
  return generator.generate();
}

module.exports = { generateSolidity, SolidityGenerator };