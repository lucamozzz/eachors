import BpmnPropertiesProvider from 'bpmn-js-properties-panel/lib/provider/bpmn/BpmnPropertiesProvider.js';
import inherits from 'inherits';
import { is } from 'bpmn-js/lib/util/ModelUtil';
import cmdHelper from 'bpmn-js-properties-panel/lib/helper/CmdHelper';
import entryFactory from 'bpmn-js-properties-panel/lib/factory/EntryFactory';
import eventDefinitionHelper from 'bpmn-js-properties-panel/lib/helper/EventDefinitionHelper';
import conditionalProps from 'bpmn-js-properties-panel/lib/provider/camunda/parts/ConditionalProps.js';
import messageDefinition from './MessageDefinition';

export default function ChorPropertiesProvider(injector, bpmnFactory, getPlaces) {
  injector.invoke(BpmnPropertiesProvider, this);
  const superGetTabs = this.getTabs;

  this.getTabs = function(element) {
    const tabs = superGetTabs.call(this, element);

    // primo tab (General)
    const general = Array.isArray(tabs) ? tabs[0] : null;
    if (!general) return tabs;

    // gruppo 'details'
    const detailsGroup = Array.isArray(general.groups)
      ? general.groups.filter(g => g.id === 'details')[0]
      : null;
    if (!detailsGroup) return tabs;

    // Event: conditional / message
    if (is(element, 'bpmn:Event')) {
      const defs = element.businessObject.eventDefinitions || [];
      const def0 = defs[0];

      if (def0 && def0.$type === 'bpmn:ConditionalEventDefinition') {
        detailsGroup.entries = [];
        this.conditionalEvent(detailsGroup, element);
        return tabs;
      }

      if (def0 && def0.$type === 'bpmn:MessageEventDefinition') {
        // usa sempre element.businessObject per mantenere Message Type
        messageDefinition(detailsGroup, element, bpmnFactory, element.businessObject, getPlaces);
        return tabs;
      }
    }

    // Solo per SequenceFlow
    if (is(element, 'bpmn:SequenceFlow')) {
      detailsGroup.entries.push(entryFactory.textField({
        id: 'sequence-flow-guard',
        label: 'Guard Condition',
        modelProperty: 'guard',
        get: function(el) {
          const bo = el.businessObject;
          return { guard: bo.get ? (bo.get('guard') || '') : '' };
        },
        set: function(el, values) {
          const bo = el.businessObject;
          return cmdHelper.updateBusinessObject(el, bo, { guard: values.guard || '' });
        }
      }));
      return tabs;
    }
    
    if (is(element, 'bpmn:Participant')) {
  detailsGroup.entries.push(entryFactory.selectBox({
    id: 'participant-StartingPlace',
    label: 'Starting Place',
    modelProperty: 'participantPlace', // qui scegli nome property custom
    selectOptions: (typeof getPlaces === 'function' ? (getPlaces() || []).map(p => ({
      value: p.id,
      name: p.name ? `${p.name} (${p.id})` : p.id
    })) : []),
    get: function(el) {
      const bo = el.businessObject;
      return { participantPlace: (bo && bo.get) ? (bo.get('participantPlace') || '') : '' };
    },
    set: function(el, values) {
      const bo = el.businessObject;
      return cmdHelper.updateBusinessObject(el, bo, { participantPlace: values.participantPlace || '' });
    }
  }));
  return tabs;
}

    // Aggiungi le proprietà Camunda per conditional events
    conditionalProps(detailsGroup, element, bpmnFactory, e => e);

    // bpmn:Message standalone
    if (is(element, 'bpmn:Message')) {
      messageDefinition(detailsGroup, element, bpmnFactory, element.businessObject, getPlaces);
    }

    return tabs;
  };
}

ChorPropertiesProvider.prototype.conditionalEvent = function(group, element) {
  const getValue = function(conditionalEvent) {
    const def = eventDefinitionHelper.getConditionalEventDefinition(conditionalEvent);
    return { condition: def.condition.body };
  };
  const setValue = function(conditionalEvent, values) {
    const def = eventDefinitionHelper.getConditionalEventDefinition(conditionalEvent);
    const condition = def.condition;
    return cmdHelper.updateBusinessObject(conditionalEvent, condition, { body: values.condition });
  };
  group.entries.push(entryFactory.textField({
    id: 'condition',
    label: 'Condition Expression',
    modelProperty: 'condition',
    get: getValue,
    set: setValue
  }));
};

ChorPropertiesProvider.$inject = [
  'injector',
  'bpmnFactory',
  'getPlaces' // <-- nuova dipendenza
];

inherits(ChorPropertiesProvider, BpmnPropertiesProvider);
