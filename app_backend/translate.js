import xml2js from 'xml2js';
import fs from 'fs/promises';

export default class Translator {
  constructor() {
    this.modelInstance = null;
    this.participants = [];
    this.participantsWithoutDuplicates = [];
    this.allNodes = [];
    this.elementsID = [];
    this.nodeSet = [];
    this.gatewayGuards = [];
    this.taskIdAndRole = new Map();
    this.taskIdAndName = new Map();
    this.taskIdInt = new Map();
    this.roleFortask = [];

    // Counters
    this.globalCounter = 0;
    this.startCounter = 0;
    this.xorCounter = 0;
    this.eventBasedCounter = 0;
    this.parallelCounter = 0;
    this.endEventCounter = 0;

    this.startEventAdd = '';

    // Maps for quick lookup
    this.messagesMap = new Map();
    this.participantsMap = new Map();
    this.choreographyTasksMap = new Map();
  }

  resolveNextElementId(sequenceFlowId) {
    const targetId = this.findTargetId(sequenceFlowId);
    if (!targetId) return null;

    const targetNode = this.allNodes.find(n => n.element.id === targetId);

    if (!targetNode) return targetId;

    // Se è un gateway o end event, usa direttamente il suo ID
    if (targetNode.type.includes('Gateway') ||
      targetNode.type === 'endEvent' ||
      targetNode.type === 'startEvent') {
      return targetId;
    }

    // Se è un choreography task, prendi l'ID del suo primo messaggio (top)
    if (targetNode.type === 'choreographyTask') {
      return this.getTaskMessageId(targetId, false); // false = prendi top message
    }

    return targetId;
  }

  getTaskMessageId(taskId, preferBottom = true) {
    const taskNode = this.allNodes.find(n =>
      n.type === 'choreographyTask' && n.element.id === taskId
    );

    if (!taskNode) return taskId;

    const task = taskNode.element;
    const messageFlowRefs = task['bpmn2:messageFlowRef'];
    const messageFlowArray = Array.isArray(messageFlowRefs) ?
      messageFlowRefs : [messageFlowRefs];

    let topMessage = null;
    let bottomMessage = null;

    // Identifica messaggi top e bottom
    messageFlowArray.forEach(msgFlowRef => {
      const messageFlow = this.findMessageFlow(msgFlowRef);
      if (messageFlow && messageFlow.messageRef) {
        const message = this.messagesMap.get(messageFlow.messageRef);
        if (message) {
          // Se sourceRef è il participant iniziatore, è top (request)
          // Altrimenti è bottom (response)
          if (messageFlow.sourceRef === task.initiatingParticipantRef) {
            topMessage = message.id;
          } else {
            bottomMessage = message.id;
          }
        }
      }
    });

    // Se preferBottom è true e esiste bottom, ritorna bottom
    // Altrimenti ritorna top
    if (preferBottom && bottomMessage) {
      return bottomMessage;
    }

    return topMessage || taskId;
  }

  async translateBPMNFile(bpmnFilePath, participantsConfig, optionalRoles = [], mandatoryRoles = []) {
    try {
      // Read and parse BPMN file
      const bpmnContent = await fs.readFile(bpmnFilePath, 'utf-8');
      const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
      this.modelInstance = await parser.parseStringPromise(bpmnContent);

      // Extract data from BPMN
      this.extractMessages();
      this.extractParticipants();
      this.extractChoreographyElements();

      // Generate Solidity contract
      const fileName = bpmnFilePath.split('/').pop().replace('.bpmn', '');
      const solidityCode = this.generateSolidityContract(fileName, participantsConfig, optionalRoles, mandatoryRoles);

      return {
        solidityCode,
        taskIdAndRole: Object.fromEntries(this.taskIdAndRole),
        taskIdAndName: Object.fromEntries(this.taskIdAndName),
        gatewayGuards: this.gatewayGuards
      };
    } catch (error) {
      console.error('Error translating BPMN:', error);
      throw error;
    }
  }

  extractMessages() {
    const definitions = this.modelInstance['bpmn2:definitions'];
    const messages = definitions['bpmn2:message'];

    if (!messages) return;

    const messageArray = Array.isArray(messages) ? messages : [messages];
    messageArray.forEach(msg => {
      this.messagesMap.set(msg.id, {
        id: msg.id,
        name: msg.name || '',
        guard: msg['msg:guard'],
        guardType: msg.guardType,
        messageType: msg['msg:messageType']
      });
    });
  }

  extractParticipants() {
    const choreography = this.getChoreography();
    const participants = choreography['bpmn2:participant'];

    if (!participants) return;

    const participantArray = Array.isArray(participants) ? participants : [participants];
    participantArray.forEach(p => {
      this.participants.push(p.name);
      this.participantsMap.set(p.id, p.name);
    });

    this.participantsWithoutDuplicates = [...new Set(this.participants)];
  }

  getChoreography() {
    return this.modelInstance['bpmn2:definitions']['bpmn2:choreography'];
  }

  extractChoreographyElements() {
    const choreography = this.getChoreography();

    // Extract all choreography elements
    Object.keys(choreography).forEach(key => {
      if (key.startsWith('bpmn2:')) {
        const elements = choreography[key];
        const elementArray = Array.isArray(elements) ? elements : [elements];

        elementArray.forEach(element => {
          if (element.id) {
            this.allNodes.push({
              type: key.replace('bpmn2:', ''),
              element: element
            });
          }
        });
      }
    });
  }

  generateSolidityContract(fileName, participantsConfig, optionalRoles, mandatoryRoles) {
    // Process all nodes to build element structure
    this.processFlowNodes();

    let contract = '';

    // Add pragma and contract declaration
    contract += this.generateHeader(fileName, optionalRoles, mandatoryRoles);

    // Add constructor
    contract += this.generateConstructor(participantsConfig, optionalRoles);

    // Add modifiers and utility functions
    contract += this.generateModifiersAndUtilities(optionalRoles);

    // Generate functions for all choreography tasks and gateways
    contract += this.generateChoreographyFunctions(optionalRoles, mandatoryRoles);

    // Add final utility functions
    contract += this.generateFinalFunctions();

    contract += '\n}';

    return contract;
  }

  generateHeader(fileName, optionalRoles, mandatoryRoles) {
    const contractName = this.parseName(fileName);

    let header = `// SPDX-License-Identifier: MIT
import "./env.sol";

pragma solidity ^0.8.0;

contract ${contractName} {
    event functionDone(string);

    Environment public environmentContract;

    mapping(string => uint) position;
    mapping(string => address payable) roles;

    enum State {
        DISABLED,
        ENABLED,
        DONE
    }

    struct Element {
        string ID;
        State status;
    }

    struct StateMemory {\n`;

    // Add gateway guards to StateMemory
    this.gatewayGuards.forEach(guard => {
      header += `        ${guard};\n`;
    });

    header += `    }\n\n`;
    header += `    Element[] elements;\n`;
    header += `    StateMemory currentMemory;\n`;

    // Add elementsID array
    header += `    string[] elementsID = [\n`;
    this.elementsID.forEach((id, index) => {
      header += `        "${id}"`;
      if (index < this.elementsID.length - 1) header += ',';
      header += '\n';
    });
    header += `    ];\n`;

    // Add roleList
    header += `    string[] roleList = [\n`;
    mandatoryRoles.forEach((role, index) => {
      header += `        "${role}"`;
      if (index < mandatoryRoles.length - 1) header += ',';
      header += '\n';
    });
    header += `    ];\n\n`;

    return header;
  }

  generateConstructor(participantsConfig, optionalRoles) {
    let constructor = `    constructor(address environmentAddress) {\n`;

    // Initialize elements array
    constructor += `        for (uint i = 0; i < elementsID.length; i++) {\n`;
    constructor += `            elements.push(Element(elementsID[i], State.DISABLED));\n`;
    constructor += `            position[elementsID[i]] = i;\n`;
    constructor += `        }\n\n`;

    constructor += `        environmentContract = Environment(environmentAddress);\n\n`;

    // Set roles
    Object.entries(participantsConfig).forEach(([role, address]) => {
      constructor += `        roles["${role}"] = payable(${address});\n`;
    });

    constructor += `\n        enable("${this.startEventAdd}");\n`;
    constructor += `        ${this.parseSid(this.startEventAdd)}();\n\n`;
    constructor += `        emit functionDone("Contract creation");\n`;
    constructor += `    }\n\n`;

    return constructor;
  }

  generateModifiersAndUtilities(optionalRoles) {
    let code = `    modifier checkMand(string memory role) {\n`;
    code += `        require(msg.sender == roles[role]);\n`;
    code += `        _;\n`;
    code += `    }\n\n`;

    code += `    function enable(string memory _taskID) internal {\n`;
    code += `        elements[position[_taskID]].status = State.ENABLED;\n`;
    code += `    }\n\n`;

    code += `    function disable(string memory _taskID) internal {\n`;
    code += `        elements[position[_taskID]].status = State.DISABLED;\n`;
    code += `    }\n\n`;

    code += `    function done(string memory _taskID) internal {\n`;
    code += `        elements[position[_taskID]].status = State.DONE;\n`;
    code += `        emit functionDone(_taskID);\n`;
    code += `    }\n\n`;

    code += `    function getCurrentState()\n`;
    code += `        public\n`;
    code += `        view\n`;
    code += `        returns (Element[] memory, StateMemory memory)\n`;
    code += `    {\n`;
    code += `        return (elements, currentMemory);\n`;
    code += `    }\n\n`;

    return code;
  }

  processFlowNodes() {
    // Find start event first
    const startEvent = this.allNodes.find(n => n.type === 'startEvent');
    if (startEvent) {
      this.startEventAdd = startEvent.element.id;
      this.addElement(this.startEventAdd, 'internal', startEvent.element.name || `startEvent_${this.startCounter++}`);
    }

    // Process all nodes
    this.allNodes.forEach(node => {
      this.processNode(node);
    });
  }

  processNode(node) {
    const { type, element } = node;

    switch (type) {
      case 'choreographyTask':
        this.processChoreographyTask(element);
        break;
      case 'exclusiveGateway':
        this.processGateway(element, 'exclusiveGateway');
        break;
      case 'parallelGateway':
        this.processGateway(element, 'parallelGateway');
        break;
      case 'eventBasedGateway':
        this.processGateway(element, 'eventBasedGateway');
        break;
      case 'endEvent':
        this.processEndEvent(element);
        break;
    }
  }

  processChoreographyTask(task) {
    const messageFlowRefs = task['bpmn2:messageFlowRef'];
    const messageFlowArray = Array.isArray(messageFlowRefs) ? messageFlowRefs : [messageFlowRefs];

    messageFlowArray.forEach(msgFlowRef => {
      if (msgFlowRef) {
        const messageFlow = this.findMessageFlow(msgFlowRef);
        if (messageFlow && messageFlow.messageRef) {
          const message = this.messagesMap.get(messageFlow.messageRef);
          if (message && message.name) {
            const messageId = message.id;
            const initiatingParticipant = this.participantsMap.get(task.initiatingParticipantRef);

            this.addElement(messageId, initiatingParticipant, message.name);
            this.extractGuardsFromMessage(message);
          }
        }
      }
    });
  }

  findMessageFlow(messageFlowRef) {
    const choreography = this.getChoreography();
    const messageFlows = choreography['bpmn2:messageFlow'];

    if (!messageFlows) return null;

    const flowArray = Array.isArray(messageFlows) ? messageFlows : [messageFlows];
    return flowArray.find(flow => flow.id === messageFlowRef);
  }

  processGateway(gateway, type) {
    let name = gateway.name;
    if (!name) {
      switch (type) {
        case 'exclusiveGateway':
          name = `ExclusiveGateway_${this.xorCounter++}`;
          break;
        case 'parallelGateway':
          name = `ParallelGateway_${this.parallelCounter++}`;
          break;
        case 'eventBasedGateway':
          name = `EventBasedGateway_${this.eventBasedCounter++}`;
          break;
      }
    }
    this.addElement(gateway.id, 'internal', name);
  }

  processEndEvent(endEvent) {
    const name = endEvent.name || `EndEvent_${this.endEventCounter++}`;
    this.addElement(endEvent.id, 'internal', name);
  }

  addElement(id, role, name) {
    if (!this.elementsID.includes(id)) {
      this.elementsID.push(id);
      this.taskIdAndRole.set(id, role);
      this.taskIdAndName.set(id, name);
      this.roleFortask.push(role);

      if (!this.taskIdInt.has(id)) {
        this.taskIdInt.set(id, this.globalCounter++);
      }
    }
  }

  extractGuardsFromMessage(message) {
    if (message.name) {
      const params = this.extractParameters(message.name);
      params.forEach(param => {
        const guardDeclaration = `${param.type} ${param.name}`;
        if (!this.gatewayGuards.includes(guardDeclaration)) {
          this.gatewayGuards.push(guardDeclaration);
        }
      });
    }
  }

  extractParameters(messageName) {
    const match = messageName.match(/\((.*?)\)/);
    if (!match || !match[1]) return [];

    const params = match[1].split(',').map(p => p.trim());
    return params.map(param => {
      const parts = param.split(' ');
      return {
        type: parts[0],
        name: parts.slice(1).join(' ')
      };
    });
  }

  generateChoreographyFunctions(optionalRoles, mandatoryRoles) {
    let functions = '';

    this.allNodes.forEach(node => {
      const func = this.generateNodeFunction(node, optionalRoles, mandatoryRoles);
      if (func) {
        functions += func + '\n';
      }
    });

    return functions;
  }

  generateNodeFunction(node, optionalRoles, mandatoryRoles) {
    const { type, element } = node;
    const id = element.id;

    if (type === 'startEvent') {
      return this.generateStartEventFunction(element);
    } else if (type === 'endEvent') {
      return this.generateEndEventFunction(element);
    } else if (type === 'choreographyTask') {
      return this.generateChoreographyTaskFunction(element, optionalRoles, mandatoryRoles);
    } else if (type.includes('Gateway')) {
      return this.generateGatewayFunction(element, type);
    }

    return '';
  }

  generateStartEventFunction(startEvent) {
    const id = startEvent.id;
    const outgoing = startEvent['bpmn2:outgoing'];
    const nextId = this.resolveNextElementId(outgoing); // <-- USA resolveNextElementId

    return `    function ${this.parseSid(id)}() private {
      require(
          elements[position["${id}"]].status == State.ENABLED
      );
      done("${id}");
      enable("${nextId}");
  }\n`;
  }

  generateEndEventFunction(endEvent) {
    const id = endEvent.id;

    return `    function ${this.parseSid(id)}() private {
        require(elements[position["${id}"]].status == State.ENABLED);
        done("${id}");
    }\n`;
  }

  generateChoreographyTaskFunction(task, optionalRoles, mandatoryRoles) {
    const messageFlowRefs = task['bpmn2:messageFlowRef'];
    const messageFlowArray = Array.isArray(messageFlowRefs) ? messageFlowRefs : [messageFlowRefs];

    let functions = '';

    messageFlowArray.forEach(msgFlowRef => {
      const messageFlow = this.findMessageFlow(msgFlowRef);
      if (messageFlow && messageFlow.messageRef) {
        const message = this.messagesMap.get(messageFlow.messageRef);
        if (message && message.name) {
          const func = this.generateTaskFunction(task, message, messageFlow, optionalRoles, mandatoryRoles);
          functions += func;
        }
      }
    });

    return functions;
  }

  generateTaskFunction(task, message, messageFlow, optionalRoles, mandatoryRoles) {
    const functionName = message.name.split('(')[0];
    const params = this.extractParameters(message.name);

    // <-- MODIFICA: Aggiungi "memory" solo per tipi che lo richiedono
    const paramsStr = params.map(p => {
      const needsMemory = !['bytes32', 'uint', 'uint256', 'int', 'int256', 'bool', 'address'].includes(p.type);
      return needsMemory ? `${p.type} memory ${p.name}` : `${p.type} ${p.name}`;
    }).join(', ');

    const initiatingParticipant = this.participantsMap.get(task.initiatingParticipantRef);
    const roleIndex = mandatoryRoles.indexOf(initiatingParticipant);
    const checkRole = roleIndex >= 0 ? `checkMand(roleList[${roleIndex}])` : '';

    let func = `    function ${functionName}(\n`;
    func += `        ${paramsStr}\n`;
    func += `    ) public ${checkRole} {\n`;
    func += `        require(elements[position["${message.id}"]].status == State.ENABLED);\n`;

    // Add guard if present
    if (message.guard) {
      func += `        require(\n`;
      func += `            ${this.convertGuardToSolidity(message.guard, message.guardType)}\n`;
      func += `        );\n\n`;
    }

    // Update state memory
    params.forEach(param => {
      func += `        currentMemory.${param.name} = ${param.name};\n`;
    });

    func += `        done("${message.id}");\n`;

    // LOGICA per determinare il prossimo elemento
    const taskElement = task;
    const messageFlowRefs = taskElement['bpmn2:messageFlowRef'];
    const messageFlowArray = Array.isArray(messageFlowRefs) ?
      messageFlowRefs : [messageFlowRefs];

    const isTopMessage = messageFlow.sourceRef === task.initiatingParticipantRef;

    if (isTopMessage && messageFlowArray.length > 1) {
      const bottomMessageId = this.getTaskMessageId(task.id, true);
      func += `        enable("${bottomMessageId}");\n`;
    }
    else {
      const outgoing = taskElement['bpmn2:outgoing'];
      if (outgoing) {
        const nextId = this.resolveNextElementId(outgoing);
        func += `        enable("${nextId}");\n`;

        const nextNode = this.allNodes.find(n => n.element.id === this.findTargetId(outgoing));
        if (nextNode && (nextNode.type.includes('Gateway') || nextNode.type === 'endEvent')) {
          func += `        ${this.parseSid(this.findTargetId(outgoing))}();\n`;
        }
      }
    }

    func += `    }\n\n`;

    return func;
  }

  generateGatewayFunction(gateway, type) {
    const id = gateway.id;
    const name = gateway.name || id;

    let func = `    function ${this.parseSid(id)}() private {\n`;
    func += `        require(\n`;
    func += `            elements[position["${id}"]].status ==\n`;
    func += `                State.ENABLED\n`;
    func += `        );\n`;
    func += `        done("${id}");\n`;

    const outgoing = gateway['bpmn2:outgoing'];
    const outgoingArray = Array.isArray(outgoing) ? outgoing : [outgoing];

    if (type === 'exclusiveGateway') {
      const guardType = gateway.guardType; // <-- AGGIUNGI QUESTO
      func += this.generateExclusiveGatewayLogic(gateway, outgoingArray, guardType); // <-- PASSA guardType
    } else if (type === 'parallelGateway') {
      func += this.generateParallelGatewayLogic(gateway, outgoingArray);
    } else if (type === 'eventBasedGateway') {
      func += this.generateEventBasedGatewayLogic(gateway, outgoingArray);
    }

    func += `    }\n\n`;

    return func;
  }

  generateExclusiveGatewayLogic(gateway, outgoingArray, guardType) {
    let logic = '';
    const sequenceFlows = this.findSequenceFlows(outgoingArray);

    sequenceFlows.forEach((flow, index) => {
      const targetId = this.resolveNextElementId(flow.id);
      const condition = flow.name;

      if (condition) {
        const ifStatement = index === 0 ? 'if' : 'else if';
        logic += `        ${ifStatement} (\n`;

        // <-- MODIFICA QUI: passa guardType e gatewayId
        logic += `            ${this.convertGuardToSolidity(condition, guardType, gateway.id)}\n`;

        logic += `        ) {\n`;
        logic += `            enable("${targetId}");\n`;

        const actualTargetId = flow.targetRef;
        const targetNode = this.allNodes.find(n => n.element.id === actualTargetId);
        if (targetNode && (targetNode.type.includes('Gateway') || targetNode.type === 'endEvent')) {
          logic += `            ${this.parseSid(actualTargetId)}();\n`;
        }

        logic += `        }\n`;
      } else {
        logic += `        enable("${targetId}");\n`;
        const actualTargetId = flow.targetRef;
        const targetNode = this.allNodes.find(n => n.element.id === actualTargetId);
        if (targetNode && (targetNode.type.includes('Gateway') || targetNode.type === 'endEvent')) {
          logic += `        ${this.parseSid(actualTargetId)}();\n`;
        }
      }
    });

    return logic;
  }

  generateParallelGatewayLogic(gateway, outgoingArray) {
    let logic = '';
    const incoming = gateway['bpmn2:incoming'];
    const incomingArray = Array.isArray(incoming) ? incoming : [incoming];

    // Split gateway
    if (incomingArray.length === 1) {
      outgoingArray.forEach(outId => {
        const targetId = this.resolveNextElementId(outId); // <-- USA resolveNextElementId
        logic += `        enable("${targetId}");\n`;

        const targetNode = this.allNodes.find(n => n.element.id === targetId);
        if (targetNode && (targetNode.type.includes('Gateway') || targetNode.type === 'endEvent')) {
          logic += `        ${this.parseSid(targetId)}();\n`;
        }
      });
    }
    // Join gateway
    else {
      logic += `        if( `;
      const conditions = incomingArray.map((incId, index) => {
        const sourceId = this.findSourceId(incId);
        return `elements[position["${sourceId}"]].status == State.DONE`;
      }).join(' && ');
      logic += conditions + ` ) { \n`;

      outgoingArray.forEach(outId => {
        const targetId = this.findTargetId(outId);
        logic += `            enable("${targetId}");\n`;

        const targetNode = this.allNodes.find(n => n.element.id === targetId);
        if (targetNode && (targetNode.type.includes('Gateway') || targetNode.type === 'endEvent')) {
          logic += `            ${this.parseSid(targetId)}();\n`;
        }
      });

      logic += `        }\n`;
    }

    return logic;
  }

  generateEventBasedGatewayLogic(gateway, outgoingArray) {
    let logic = '';

    outgoingArray.forEach(outId => {
      const targetId = this.resolveNextElementId(outId); // <-- USA resolveNextElementId
      logic += `        enable("${targetId}");\n`;
    });

    return logic;
  }

  findSequenceFlows(outgoingArray) {
    const choreography = this.getChoreography();
    const sequenceFlows = choreography['bpmn2:sequenceFlow'];

    if (!sequenceFlows) return [];

    const flowArray = Array.isArray(sequenceFlows) ? sequenceFlows : [sequenceFlows];

    return outgoingArray.map(outId => {
      return flowArray.find(flow => flow.id === outId);
    }).filter(Boolean);
  }

  findTargetId(sequenceFlowId) {
    const choreography = this.getChoreography();
    const sequenceFlows = choreography['bpmn2:sequenceFlow'];

    if (!sequenceFlows) return null;

    const flowArray = Array.isArray(sequenceFlows) ? sequenceFlows : [sequenceFlows];
    const flow = flowArray.find(f => f.id === sequenceFlowId);

    return flow ? flow.targetRef : null;
  }

  findSourceId(sequenceFlowId) {
    const choreography = this.getChoreography();
    const sequenceFlows = choreography['bpmn2:sequenceFlow'];

    if (!sequenceFlows) return null;

    const flowArray = Array.isArray(sequenceFlows) ? sequenceFlows : [sequenceFlows];
    const flow = flowArray.find(f => f.id === sequenceFlowId);

    return flow ? flow.sourceRef : null;
  }

  convertGuardToSolidity(guard, guardType = null, gatewayId = null) {
    // ============================================
    // CASO 1: guardType="reachability"
    // ============================================
    if (guardType === 'reachability') {
      const isTrueCondition = guard.includes('== true');
      const isFalseCondition = guard.includes('== false');

      if (isTrueCondition) {
        return `environmentContract.isReachable("${gatewayId}") == true`;
      } else if (isFalseCondition) {
        return `environmentContract.isReachable("${gatewayId}") == false`;
      }

      return `environmentContract.isReachable("${gatewayId}") == true`;
    }

    // ============================================
    // CASO 2: guardType="environmental"
    // ============================================
    if (guardType === 'environmental') {
      // Pattern: location.attribute OPERATOR value
      const patterns = [
        { regex: /(\w+)\.(\w+)\s*==\s*(\d+)/, op: '==' },
        { regex: /(\w+)\.(\w+)\s*>\s*(\d+)/, op: '>' },
        { regex: /(\w+)\.(\w+)\s*<\s*(\d+)/, op: '<' },
        { regex: /(\w+)\.(\w+)\s*>=\s*(\d+)/, op: '>=' },
        { regex: /(\w+)\.(\w+)\s*<=\s*(\d+)/, op: '<=' },
        { regex: /(\w+)\.(\w+)\s*!=\s*(\d+)/, op: '!=' }
      ];

      for (const pattern of patterns) {
        const match = guard.match(pattern.regex);
        if (match) {
          const location = match[1];
          const attribute = match[2];
          const value = match[3];

          // <-- MODIFICA: Converti il valore numerico in bytes32(uint256(...))
          return `environmentContract.getAttribute(currentMemory.${location}, "${attribute}") ${pattern.op} bytes32(uint256(${value}))`;
        }
      }

      // Pattern per valori stringa: location.attribute=="value"
      const stringPattern = /(\w+)\.(\w+)\s*==\s*"([^"]+)"/;
      const stringMatch = guard.match(stringPattern);
      if (stringMatch) {
        const location = stringMatch[1];
        const attribute = stringMatch[2];
        const value = stringMatch[3];

        return `environmentContract.getAttribute(\n` +
          `                currentMemory.${location},\n` +
          `                "${attribute}"\n` +
          `            ) == bytes32("${value}")`;
      }
    }

    // ============================================
    // CASO 3: Guard sui messaggi (guards normali)
    // ============================================

    if (guard.includes('.')) {
      const parts = guard.split('.');
      const location = parts[0];
      const rest = parts[1];

      if (rest.includes('==')) {
        const [attribute, value] = rest.split('==');

        if (value === 'false' || value === '"false"') {
          return `environmentContract.getAttribute(\n` +
            `                currentMemory.${location},\n` +
            `                "${attribute}"\n` +
            `            ) == bytes32("false")`;
        } else if (value === 'true' || value === '"true"') {
          return `environmentContract.getAttribute(\n` +
            `                currentMemory.${location},\n` +
            `                "${attribute}"\n` +
            `            ) == bytes32("true")`;
        } else {
          // <-- MODIFICA: Se è un numero, converti in bytes32(uint256(...))
          const numericValue = parseInt(value);
          if (!isNaN(numericValue)) {
            return `environmentContract.getAttribute(currentMemory.${location}, "${attribute}") == bytes32(uint256(${numericValue}))`;
          }
          return `environmentContract.getAttribute(currentMemory.${location}, "${attribute}") == ${value}`;
        }
      }
    }

    // ============================================
    // CASO 4: Guard di posizione (position guards)
    // ============================================
    if (guard.includes('isPosition')) {
      const match = guard.match(/isPosition\((.*?),\s*(.*?)\)/);
      if (match) {
        const participant = match[1].trim();
        const position = match[2].trim();
        return `environmentContract.getParticipantPosition("${participant}") ==\n` +
          `                "${position}"`;
      }
    }

    return guard;
  }

  generateFinalFunctions() {
    return '';
  }

  parseName(fileName) {
    return fileName.replace(/[^a-zA-Z0-9]/g, '');
  }

  parseSid(sid) {
    return sid.replace(/-/g, '_');
  }
}