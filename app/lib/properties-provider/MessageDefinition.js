import eventDefinitionReference from 'bpmn-js-properties-panel/lib/provider/bpmn/parts/implementation/EventDefinitionReference';
import elementReferenceProperty from 'bpmn-js-properties-panel/lib/provider/bpmn/parts/implementation/ElementReferenceProperty';
import entryFactory from 'bpmn-js-properties-panel/lib/factory/EntryFactory';
import cmdHelper from 'bpmn-js-properties-panel/lib/helper/CmdHelper';

export default function MessageDefinition(group, element, bpmnFactory, messageEventDefinition, getPlaces) {

  function createStructureRefTextField() {
    const modelProperty = 'structureRef';
    const entry = entryFactory.textField({
      id: 'structure-ref',
      label: 'Data Structure',
      modelProperty,
      get: function(el) {
        const reference = el.businessObject.itemRef;
        const props = {};
        props[modelProperty] = reference && reference.get ? reference.get(modelProperty) : undefined;
        return props;
      },
      set: function(el, values) {
        const reference = el.businessObject.itemRef;
        const props = {};
        props[modelProperty] = values[modelProperty] || undefined;
        return cmdHelper.updateBusinessObject(el, reference, props);
      },
      hidden: function(el) {
        return !el.businessObject.itemRef;
      }
    });
    return [ entry ];
  }

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

  function createDestinationSelect() {
    const MODEL_PROP = 'messageDestination';
    const toOptions = () => {
      const places = (typeof getPlaces === 'function') ? (getPlaces() || []) : [];
      return places.map(p => ({
        value: p.id,
        name: p.name ? `${p.name} (${p.id})` : p.id
      }));
    };
    const entry = entryFactory.selectBox({
      id: 'message-destination',
      label: 'Destination',
      modelProperty: MODEL_PROP,
      selectOptions: toOptions(),
      get: function(el) {
        const bo = el.businessObject;
        return { [MODEL_PROP]: (bo && bo.get) ? (bo.get(MODEL_PROP) || '') : '' };
      },
      set: function(el, values) {
        const bo = el.businessObject;
        return cmdHelper.updateBusinessObject(el, bo, { [MODEL_PROP]: values[MODEL_PROP] || '' });
      },
      hidden: function(el) {
        const bo = el.businessObject;
        const type = (bo && bo.get) ? (bo.get('messageType') || 'base') : 'base';
        return type !== 'movement';
      }
    });
    return [ entry ];
  }

  // Se messageEventDefinition è proprio un MessageEventDefinition, aggiungi le voci ItemDefinition
  if (messageEventDefinition && messageEventDefinition.$type === 'bpmn:MessageEventDefinition') {
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

    group.entries = group.entries.concat(createStructureRefTextField());
  }

  // Sempre disponibili su bpmn:Message (o messaggio referenziato)
  group.entries = group.entries.concat(createMessageTypeSelect());
  group.entries = group.entries.concat(createDestinationSelect());

  // GUARD FIELD
group.entries.push(entryFactory.textField({
  id: "message-guard",
  label: "Guard condition (if ...)",
  modelProperty: "guard",
  get: function(el) {
    const bo = el.businessObject;
    return { guard: bo.get ? (bo.get("guard") || "") : "" };
  },
  set: function(el, values) {
    const bo = el.businessObject;
    return cmdHelper.updateBusinessObject(el, bo, { guard: values.guard || "" });
  }
}));


// ASSIGNMENTS (multiple row text fields)
group.entries.push(entryFactory.table({
  id: 'message-assignments',
  modelProperties: ['attribute', 'value'],
  labels: ['Attribute', 'Value'],
  addLabel: 'Add Assignment',

  getElements: function(element) {
    const bo = element.businessObject;
    // Assicurati che 'assignments' sia sempre un array
    return bo.assignments || [];
  },

  addElement: function(element, rootElement) {
    const bo = element.businessObject;
    const newAssignment = bpmnFactory.create('msg:Assignment', {
      attribute: 'place.attribute', // Valore di default
      value: 'newValue'           // Valore di default
    });

    // FONDAMENTALE: Imposta il parent del nuovo elemento prima di aggiungerlo.
    // Il businessObject (il messaggio) è il genitore del nuovo assignment.
    newAssignment.$parent = bo;

    const currentAssignments = bo.get('assignments') || [];

    // Aggiorna il businessObject con la nuova lista di assignments
    return cmdHelper.updateBusinessObject(element, bo, {
      assignments: [ ...currentAssignments, newAssignment ]
    });
  },

  updateElement: function(element, values, node, idx) {
    const bo = element.businessObject;
    const assignment = bo.assignments[idx];

    // Se l'elemento non esiste, non fare nulla (sicurezza)
    if (!assignment) {
      console.error('updateElement: assignment non trovato all’indice', idx);
      return;
    }

    // Aggiorna le proprietà direttamente sull'oggetto 'assignment' esistente.
    // Il primo argomento di updateBusinessObject è l'elemento del diagramma,
    // il secondo è l'oggetto del modello da modificare (in questo caso, l'assignment specifico).
    return cmdHelper.updateBusinessObject(element, assignment, {
      attribute: values.attribute || undefined,
      value: values.value || undefined
    });
  },

  removeElement: function(element, node, idx) {
    const bo = element.businessObject;
    const currentAssignments = bo.get('assignments') || [];

    // Rimuovi l'elemento all'indice specificato
    currentAssignments.splice(idx, 1);

    // Aggiorna il businessObject con la lista modificata
    return cmdHelper.updateBusinessObject(element, bo, {
      assignments: currentAssignments
    });
  }
}));




}
