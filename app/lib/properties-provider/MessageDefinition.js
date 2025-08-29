import eventDefinitionReference from 'bpmn-js-properties-panel/lib/provider/bpmn/parts/implementation/EventDefinitionReference';
import elementReferenceProperty from 'bpmn-js-properties-panel/lib/provider/bpmn/parts/implementation/ElementReferenceProperty';
import entryFactory from 'bpmn-js-properties-panel/lib/factory/EntryFactory';
import cmdHelper from 'bpmn-js-properties-panel/lib/helper/CmdHelper';

export default function MessageDefinition(group, element, bpmnFactory, messageEventDefinition) {

  
  group.entries = group.entries.concat(eventDefinitionReference(element, messageEventDefinition, bpmnFactory, {
    label: 'Item Definition',
    elementName: 'item-def',
    elementType: 'bpmn:ItemDefinition',
    referenceProperty: 'itemRef',
    newElementIdPrefix: 'ItemDef_'
  }));

  group.entries = group.entries.concat(elementReferenceProperty(element, messageEventDefinition, bpmnFactory, {
    id: 'Item-Def-element-name',
    label: 'Item Definition Name',
    referenceProperty: 'itemRef',
    modelProperty: 'name',
    shouldValidate: false
  }));

  function createMessageTypeSelect() {
  const MODEL_PROP = 'messageType';
  const entry = entryFactory.selectBox({
    id: 'message-type',
    label: 'Message Type',
    modelProperty: MODEL_PROP,
    selectOptions: [
      { value: 'base', name: 'Base' },
      { value: 'movement', name: 'Movement' },
      { value: 'environmental', name: 'Environmental' }
    ],
    get: function(el) {
      const bo = el.businessObject;
      return { [MODEL_PROP]: (bo && bo.get) ? (bo.get(MODEL_PROP) || 'base') : 'base' };
    },
    set: function(el, values) {
      const bo = el.businessObject;
      return cmdHelper.updateBusinessObject(el, bo, { [MODEL_PROP]: values[MODEL_PROP] || 'base' });
    }
  });
  return [ entry ];
}
  group.entries = group.entries.concat(createStructureRefTextField());
  group.entries = group.entries.concat(createMessageTypeSelect());

}

function createStructureRefTextField() {
  const modelProperty = 'structureRef';
  let entry = entryFactory.textField({
    id: 'structure-ref',
    label: 'Data Structure',
    modelProperty: modelProperty,

    get: function(element, node) {
      var reference = element.businessObject.itemRef;
      var props = {};
      props[modelProperty] = reference && reference.get(modelProperty);
      return props;
    },

    set: function(element, values, node) {
      var reference = element.businessObject.itemRef;
      var props = {};
      props[modelProperty] = values[modelProperty] || undefined;
      return cmdHelper.updateBusinessObject(element, reference, props);
    },

    hidden: function(element, node) {
      return !element.businessObject.itemRef;
    }
  });
  return [ entry ];
}


