const { ChoreographyTask, Gateway } = require('./model-enhanced.js');

class SolidityGenerator {
  constructor(model, envAddress) {
    this.model = model;
    this.envAddress = envAddress || "0x0000000000000000000000000000000000000000"; // Default safe
    this.elementIndexMap = new Map();
    this.buildElementIndexes();
    this.needsEnvironment = this.checkForEnvironmentUsage();
    this.variableTypes = new Map();
    this.collectVariableTypes();
  }

  collectVariableTypes() {
    this.model.getAllElements().forEach(element => {
      if (element instanceof ChoreographyTask) {
        if (element.requestMessage && element.requestMessage.parameters) {
          element.requestMessage.parameters.forEach(p => this.variableTypes.set(p.name, p.type));
        }
        if (element.responseMessage && element.responseMessage.parameters) {
          element.responseMessage.parameters.forEach(p => this.variableTypes.set(p.name, p.type));
        }
      }
    });

  }

  checkForEnvironmentUsage() {
    // Scansiona tutte le condizioni nei gateway per vedere se servono dati esterni
    const gateways = this.model.getGateways();
    for (const gw of gateways) {
      for (const [target, cond] of gw.getAllConditions().entries()) {
        if (cond && (cond.includes('.') || cond.includes('isReachable') || cond.includes('isPosition'))) {
          return true;
        }
      }
    }
    return false;
  }

  buildElementIndexes() {
    this.model.getAllElements().forEach((element, index) => {
      this.elementIndexMap.set(element.id, index);
    });
  }

  generate() {
    let result = '';
    result += this.generateHeader();
    result += this.generateStructures();
    result += this.generateStateVariables();
    result += this.generateConstructor();
    result += this.generateModifiers();
    result += this.generateInitFunction();
    result += this.generateUtilityFunctions();
    result += this.generateDynamicFunctions();
    result += this.generateHelperFunctions();
    result += '}\n';
    return result;
  }

  generateHeader() {
    let header = `// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;
`;
    // Genera l'interfaccia SOLO se serve
    if (this.needsEnvironment) {
      header += `
interface IEnvironment {
    function getAttribute(bytes32 id, bytes32 attributeKey) external view returns (bytes32);
    function isReachable(bytes32 conditionId) external view returns (bool);
    function getParticipantPosition(bytes32 role) external view returns (bytes32);
}
`;
    }
    header += `
contract ${this.model.processName} {
`;
    return header;
  }

  generateStructures() {
    let result = `  event functionDone(string);

  enum State { DISABLED, ENABLED, DONE }
  
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
        result += `    ${type} ${this.sanitizeName(varName)};\n`;
      });
    }
    result += `  }\n\n`;
    return result;
  }

  generateStateVariables() {
    let result = `  // State Variables
  Element[] elements;
  StateMemory currentMemory;
`;
    // Dichiara env solo se serve
    if (this.needsEnvironment) {
      result += `  IEnvironment env;\n`;
    }

    result += `
  // Mappings
  mapping(string => uint) position;
  mapping(string => address payable) roles;
  mapping(string => address payable) optionalRoles;

  // Role List
  string[] roleList = [${this.model.getRoles().map(r => `"${r}"`).join(', ')}];

`;
    return result;
  }

  generateConstructor() {
    const allElements = this.model.getAllElements();
    const roles = this.model.getRoles();

    let result = `  constructor() {
    // 1. Initialize Elements
`;
    let currentIndex = 0;
    allElements.forEach((el) => {
      result += `    elements.push(Element("${el.id}", State.DISABLED));\n`;
      result += `    position["${el.id}"] = ${currentIndex};\n`;
      currentIndex++;

      if (el instanceof ChoreographyTask && el.responseMessage) {
        result += `    elements.push(Element("${el.id}_response", State.DISABLED));\n`;
        result += `    position["${el.id}_response"] = ${currentIndex};\n`;
        currentIndex++;
      }
    });

    result += `
    // 2. Assign Roles
`;
    roles.forEach(role => {
      result += `    roles["${role}"] = payable(msg.sender);\n`;
    });

    if (this.needsEnvironment) {
      result += `
    // 3. Connect Environment (DINAMICO)
    env = IEnvironment(${this.envAddress});
`;
    }

    result += `    
    // 4. Start Process
    init();
  }

`;
    return result;
  }

  generateModifiers() {
    return `  modifier checkMand(string memory role) {
    require(msg.sender == roles[role], "Unauthorized");
    _;
  }
  modifier checkOpt(string memory role) {
    require(msg.sender == optionalRoles[role], "Unauthorized");
    _;
  }
  modifier Owner(string memory task) {
    require(elements[position[task]].status == State.ENABLED, "Task not enabled");
    _;
  }
`;
  }

  generateInitFunction() {
    const startEvent = this.model.getAllElements().find(e => e.type === 'bpmn:StartEvent');
    const startEventId = startEvent ? startEvent.id : 'StartEvent_1';
    return `  function init() internal {
      enable("${startEventId}");
      ${this.parseSid(startEventId)}();
      emit functionDone("Contract creation");
  }
`;
  }

  generateUtilityFunctions() {
    let result = `  function getRoles() public view returns(string[] memory, address[] memory) {
    uint c = roleList.length;
    string[] memory allRoles = new string[](c);
    address[] memory allAddresses = new address[](c);
    for(uint i = 0; i < roleList.length; i++) {
      allRoles[i] = roleList[i];
      allAddresses[i] = roles[roleList[i]];
    }
    return (allRoles, allAddresses);
  }
`;
    if (this.needsEnvironment) {
      result += `
  function setEnvironment(address _envAddress) public {
      env = IEnvironment(_envAddress);
  }
`;
    }

    result += `
  function subscribe_as_participant(string memory _role) public {
    if(optionalRoles[_role] == address(0)) {
      optionalRoles[_role] = payable(msg.sender);
    }
  }

 receive() external payable {}
`;
    return result;
  }

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
    if (task.requestMessage) result += this.generateRequestFunction(task);
    if (task.responseMessage) result += this.generateResponseFunction(task);
    return result;
  }

  generateRequestFunction(task) {
    const message = task.requestMessage;
    const participant = this.getParticipantRole(task.initiatingParticipant);
    const parameters = this.generateParameterString(message);
    const isPayable = message && message.name && message.name.includes('payment');

    let result = `
  function ${this.parseSid(task.id)}(${parameters}${isPayable ? ', address payable dest' : ''}) public${isPayable ? ' payable' : ''} checkMand(roleList[${this.getRoleIndex(participant)}]) {
    require(elements[position["${task.id}"]].status == State.ENABLED, "Task not enabled");
    done("${task.id}");

    // 🔹 FIX: Event Based Gateway Mutual Exclusion
    // Se questo task arriva da un EventBasedGateway, disabilita le altre scelte!
    ${this.generateEventGatewayDisableLogic(task)}

`;
    if (message && message.parameters) {
      message.parameters.forEach(p => result += `    currentMemory.${this.sanitizeName(p.name)} = ${this.sanitizeName(p.name)};\n`);
    }
    if (task.responseMessage) {
      result += `    enable("${task.id}_response");\n`;
    } else {
      result += this.generateNextElementEnabling(task);
    }
    result += '  }\n';
    return result;
  }

  generateResponseFunction(task) {
    const message = task.responseMessage;
    const participant = this.getParticipantRole(task.participants.find(p => p !== task.initiatingParticipant));
    const parameters = this.generateParameterString(message);

    let result = `
  function ${this.parseSid(task.id)}_response(${parameters}) public checkMand(roleList[${this.getRoleIndex(participant)}]) {
    require(elements[position["${task.id}_response"]].status == State.ENABLED, "Task not enabled");
    done("${task.id}_response");
`;
    if (message && message.parameters) {
      message.parameters.forEach(p => result += `    currentMemory.${this.sanitizeName(p.name)} = ${this.sanitizeName(p.name)};\n`);
    }
    result += this.generateNextElementEnabling(task);
    result += '  }\n';
    return result;
  }

  generateGatewayFunction(gateway) {
    if (gateway.isExclusive()) return this.generateExclusiveGatewayFunction(gateway);
    if (gateway.isParallel()) return this.generateParallelGatewayFunction(gateway);
    if (gateway.isEventBased()) return this.generateEventBasedGatewayFunction(gateway);
    return '';
  }

  generateExclusiveGatewayFunction(gateway) {
    let result = `  function ${this.parseSid(gateway.id)}() private {
    require(elements[position["${gateway.id}"]].status == State.ENABLED);
    done("${gateway.id}");
`;
    const conditions = Array.from(gateway.getAllConditions().entries());
    const defaultFlow = gateway.getDefaultFlow();

    if (conditions.length > 0) {
      conditions.forEach(([targetId, condition], index) => {
        const condCode = this.translateCondition(condition);
        result += `    ${index === 0 ? 'if' : 'else if'} (${condCode}) {\n      enable("${targetId}");\n`;
        if (this.model.getElementById(targetId) instanceof Gateway) result += `      ${this.parseSid(targetId)}();\n`;
        result += `    }\n`;
      });
      if (defaultFlow) {
        result += `    else {\n      enable("${defaultFlow}");\n`;
        if (this.model.getElementById(defaultFlow) instanceof Gateway) result += `      ${this.parseSid(defaultFlow)}();\n`;
        result += `    }\n`;
      } else {
        result += `    else { revert("No valid condition in XOR"); }\n`;
      }
    } else {
      const targetId = gateway.outgoing[0];
      if (targetId) {
        result += `    enable("${targetId}");\n`;
        if (this.model.getElementById(targetId) instanceof Gateway) result += `    ${this.parseSid(targetId)}();\n`;
      }
    }
    result += `  }\n`;
    return result;
  }

  generateParallelGatewayFunction(gateway) {
    let result = `  function ${this.parseSid(gateway.id)}() private {
    require(elements[position["${gateway.id}"]].status == State.ENABLED);
    done("${gateway.id}");
`;
    if (gateway.isSplit()) {
      gateway.outgoing.forEach(targetId => {
        result += `    enable("${targetId}");\n`;
        if (this.model.getElementById(targetId) instanceof Gateway) result += `    ${this.parseSid(targetId)}();\n`;
      });
    } else if (gateway.isJoin()) {
      gateway.incoming.forEach(src => result += `    require(elements[position["${src}"]].status == State.DONE);\n`);
      if (gateway.outgoing.length > 0) {
        const targetId = gateway.outgoing[0];
        result += `    enable("${targetId}");\n`;
        if (this.model.getElementById(targetId) instanceof Gateway) result += `    ${this.parseSid(targetId)}();\n`;
      }
    }
    result += '  }\n';
    return result;
  }

  generateEventBasedGatewayFunction(gateway) {
    let result = `  function ${this.parseSid(gateway.id)}() private {
    require(elements[position["${gateway.id}"]].status == State.ENABLED);
    done("${gateway.id}");
`;
    gateway.outgoing.forEach(targetId => result += `    enable("${targetId}");\n`);
    result += '  }\n';
    return result;
  }

  generateStartEventFunction(event) {
    return `  function ${this.parseSid(event.id)}() private {
    require(elements[position["${event.id}"]].status == State.ENABLED);
    done("${event.id}");
${this.generateNextElementEnabling(event)}
  }\n`;
  }

  generateEndEventFunction(event) {
    return `  function ${this.parseSid(event.id)}() private {
    require(elements[position["${event.id}"]].status == State.ENABLED);
    done("${event.id}");
  }\n`;
  }

  collectConditionVariables() {
    return Array.from(new Set(this.model.getStateVariables()));
  }

  generateNextElementEnabling(element) {
    let result = '';
    element.outgoing.forEach(targetId => {
      result += `    enable("${targetId}");\n`;
      const nextElement = this.model.getElementById(targetId);
      if (nextElement) {
        // Se è un Gateway o un EndEvent, eseguilo subito!
        if (nextElement instanceof Gateway || nextElement.type === 'bpmn:EndEvent') {
          result += `    ${this.parseSid(targetId)}();\n`;
        }
      }
    });
    return result;
  }

  generateParameterString(message) {
    if (!message || !message.parameters) return '';
    return message.parameters.map(p => `${this.mapToSolidityType(p.type, true)} ${this.sanitizeName(p.name)}`).join(', ');
  }

  translateCondition(condition) {
    if (!condition || condition === 'true') return 'true';
    if (condition === 'false') return 'false';
    condition = condition.trim();

    // Se non serve l'environment, usa la logica semplice (per Pizza)
    if (!this.needsEnvironment) {
      if (condition.includes('==')) {
        const [v, val] = condition.split('==').map(s => s.trim());
        if (val.startsWith('"')) return `compareStrings(currentMemory.${this.sanitizeName(v)}, ${val})`;
        return `currentMemory.${this.sanitizeName(v)} == ${val}`;
      }
      if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(condition)) return `currentMemory.${this.sanitizeName(condition)}`;
      return condition.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g, (match) => 'currentMemory.' + this.sanitizeName(match));
    }

    // Se serve l'environment (per Emergency), usa la logica complessa
    if (condition.includes('isReachable')) {
      let check = 'true';
      if (condition.includes('== false')) check = 'false';
      const safeString = condition.replace(/"/g, '\\"');
      return `env.isReachable(stringToBytes32("${safeString}")) == ${check}`;
    }

    const posMatch = condition.match(/isPosition\(([^,]+),([^)]+)\)/);
    if (posMatch) {
      return `env.getParticipantPosition(stringToBytes32("${posMatch[1].trim()}")) == stringToBytes32("${posMatch[2].trim()}")`;
    }

    const envMatch = condition.match(/([a-zA-Z0-9_]+)\.([a-zA-Z0-9_]+)\s*([!=<>]+)\s*(.+)/);
    if (envMatch) {
      const [_, varName, attrName, op, val] = envMatch;
      const trimmedValue = val.trim();
      const isNumber = !isNaN(trimmedValue) && !trimmedValue.startsWith('"');

      if (isNumber) {
        return `bytes32ToUint(env.getAttribute(stringToBytes32(currentMemory.${this.sanitizeName(varName)}), stringToBytes32("${attrName}"))) ${op} ${trimmedValue}`;
      } else {
        const valClean = trimmedValue.replace(/"/g, '');
        return `env.getAttribute(stringToBytes32(currentMemory.${this.sanitizeName(varName)}), stringToBytes32("${attrName}")) ${op} stringToBytes32("${valClean}")`;
      }
    }

    // Fallback standard anche in modalità environment
    if (condition.includes('==')) {
      const [v, val] = condition.split('==').map(s => s.trim());
      if (val.startsWith('"')) return `compareStrings(currentMemory.${this.sanitizeName(v)}, ${val})`;
      return `currentMemory.${this.sanitizeName(v)} == ${val}`;
    }

    return condition;
  }

  generateHelperFunctions() {
    let result = `
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
    // Genera helper environment SOLO se necessario
    if (this.needsEnvironment) {
      result += `
  function stringToBytes32(string memory source) internal pure returns (bytes32 result) {
      bytes memory tempEmptyStringTest = bytes(source);
      if (tempEmptyStringTest.length == 0) return 0x0;
      assembly { result := mload(add(source, 32)) }
  }
  function bytes32ToUint(bytes32 _bytes32) internal pure returns (uint) {
      return uint(_bytes32);
  }
`;
    }
    return result;
  }

  generateEventGatewayDisableLogic(task) {
    let logic = '';
    // Controlla se il task è preceduto da un EventBasedGateway
    if (task.incoming && task.incoming.length > 0) {
      task.incoming.forEach(sourceId => {
        const sourceElement = this.model.getElementById(sourceId);
        if (sourceElement && sourceElement.isEventBased && sourceElement.isEventBased()) {
          // Trovato un Event Gateway padre!
          // Disabilita tutti gli ALTRI outgoing che non siano questo task
          sourceElement.outgoing.forEach(siblingId => {
            if (siblingId !== task.id) {
              logic += `    disable("${siblingId}");\n`;
            }
          });
        }
      });
    }
    return logic;
  }

  // UTILS
  sanitizeName(name) {
    const reserved = ['address', 'bool', 'string', 'uint', 'int', 'bytes', 'byte', 'mapping', 'struct', 'enum', 'function', 'constructor', 'event', 'modifier', 'contract', 'library', 'interface', 'payable', 'view', 'pure', 'public', 'private', 'internal', 'external', 'storage', 'memory', 'calldata', 'virtual', 'override', 'returns', 'return', 'break', 'continue', 'if', 'else', 'for', 'while', 'do', 'new', 'delete', 'this', 'super', 'emit', 'try', 'catch', 'revert', 'require', 'assert', 'unchecked'];
    if (reserved.includes(name)) {
      return `_${name}`;
    }
    return name;
  }
  parseSid(sid) { return sid.replace(/-/g, '_'); }
  getParticipantRole(participantId) {
    const p = this.model.participants.get(participantId);
    return p ? p.name : 'Client';
  }
  getRoleIndex(roleName) { return this.model.getRoles().indexOf(roleName); }
  inferSolidityType(varName) {
    if (this.variableTypes.has(varName)) {
      return this.mapToSolidityType(this.variableTypes.get(varName));
    }
    if (varName.includes('people') || varName.includes('num')) return 'uint';
    return 'string';
  }
  mapToSolidityType(bpmnType, isParameter = false) {
    if (bpmnType === 'string') return isParameter ? 'string memory' : 'string';
    const map = { 'uint': 'uint', 'bool': 'bool' };
    return map[bpmnType] || (isParameter ? 'string memory' : 'string');
  }
  isStringValue(value) { return value.startsWith('"') && value.endsWith('"'); }
}

function generateSolidity(model, envAddress) {
  const generator = new SolidityGenerator(model, envAddress);
  return generator.generate();
}

module.exports = { generateSolidity, SolidityGenerator };