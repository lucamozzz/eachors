import BpmnPropertiesProvider from 'bpmn-js-properties-panel/lib/provider/bpmn/BpmnPropertiesProvider.js';
import inherits from 'inherits';
import { is } from 'bpmn-js/lib/util/ModelUtil';
import cmdHelper from 'bpmn-js-properties-panel/lib/helper/CmdHelper';
import entryFactory from 'bpmn-js-properties-panel/lib/factory/EntryFactory';
import eventDefinitionHelper from 'bpmn-js-properties-panel/lib/helper/EventDefinitionHelper';
import conditionalProps from 'bpmn-js-properties-panel/lib/provider/camunda/parts/ConditionalProps.js';
import messageDefinition from './MessageDefinition';
import {
  attr as svgAttr,
  create as svgCreate,
} from 'tiny-svg';


export default function ChorPropertiesProvider(injector, bpmnFactory) {
  injector.invoke(BpmnPropertiesProvider, this);
  const superGetTabs = this.getTabs;

  this.getTabs = function (element) {
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
        messageDefinition(detailsGroup, element, bpmnFactory, element.businessObject, getDynamicPlaces);
        return tabs;
      }
    }

    // Solo per SequenceFlow
    if (is(element, 'bpmn:SequenceFlow')) {
      detailsGroup.entries.push(entryFactory.textField({
        id: 'sequence-flow-guard',
        label: 'Guard Condition',
        modelProperty: 'guard',
        get: function (el) {
          const bo = el.businessObject;
          return { guard: bo.get ? (bo.get('guard') || '') : '' };
        },
        set: function (el, values) {
          const bo = el.businessObject;
          return cmdHelper.updateBusinessObject(el, bo, { guard: values.guard || '' });
        }
      }));
      return tabs;
    }

    if (is(element, 'bpmn:ExclusiveGateway')) {
      detailsGroup.entries.push(entryFactory.selectBox({
        id: 'guard-type',
        label: 'Guard Type',
        modelProperty: 'guardType',
        selectOptions: [
          { value: 'base', name: 'None' },
          { value: 'environmental', name: 'Environmental' },
          { value: 'position', name: 'Position' },
          { value: 'reachability', name: 'Reachability' }
        ],

        get: function (el) {
          const bo = el.businessObject;
          return { guardType: bo.get('guardType') || 'base' };
        },

        set: function (el, values) {
          const bo = el.businessObject;
          const isModifiedId = id =>
            id.endsWith('_env') || id.endsWith('_pos') || id.endsWith('_rea');

          if (!bo.originalId && !isModifiedId(bo.id)) {
            bo.originalId = bo.id;
          }

          if (values.guardType === 'base') {
            return cmdHelper.updateBusinessObject(el, bo, {
              guardType: 'base',
              id: bo.originalId || bo.id.replace(/(_env|_pos|_rea)$/, '')
            });
          }

          const suffix =
            values.guardType === 'environmental'
              ? '_env'
              : values.guardType === 'position'
                ? '_pos'
                : '_rea';

          const baseId = bo.originalId || bo.id.replace(/(_env|_pos|_rea)$/, '');
          const newId = baseId + suffix;

          return cmdHelper.updateBusinessObject(el, bo, {
            guardType: values.guardType,
            id: newId
          });
        }

      }));

      return tabs;
    }

    // if (is(element, 'bpmn:Participant')) {
    //   detailsGroup.entries.push(entryFactory.selectBox({
    //     id: 'participant-StartingPlace',
    //     label: 'Starting Place',
    //     modelProperty: 'participantPlace',
    //     selectOptions: getDynamicPlaces(),
    //     get: function(el) {
    //       const bo = el.businessObject;
    //       return { participantPlace: (bo && bo.get) ? (bo.get('participantPlace') || '') : '' };
    //     },
    //     set: function(el, values) {
    //       const bo = el.businessObject;
    //       return cmdHelper.updateBusinessObject(el, bo, { participantPlace: values.participantPlace || '' });
    //     }
    //   }));
    //   return tabs;
    // }

    // Aggiungi le proprietà Camunda per conditional events
    conditionalProps(detailsGroup, element, bpmnFactory, e => e);

    // bpmn:Message standalone
    if (is(element, 'bpmn:Message')) {
      messageDefinition(detailsGroup, element, bpmnFactory, element.businessObject, getDynamicPlaces);
    }

    return tabs;
  };

  function getDynamicPlaces() {
    if (typeof window.bpenvModeler?.getPhysicalPlaces === 'function') {
      const rawPlaces = window.bpenvModeler.getPhysicalPlaces();
      return rawPlaces.map(p => ({
        value: p.id,             // usa direttamente id (non p.get('id'))
        name: p.name || p.id     // se manca name, mostra l'id
      }));
    }
    return [];
  }

}

ChorPropertiesProvider.prototype.conditionalEvent = function (group, element) {
  const getValue = function (conditionalEvent) {
    const def = eventDefinitionHelper.getConditionalEventDefinition(conditionalEvent);
    return { condition: def.condition.body };
  };
  const setValue = function (conditionalEvent, values) {
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
  'bpmnFactory'
];

inherits(ChorPropertiesProvider, BpmnPropertiesProvider);


// function createGuardTypeIcon(guardType) {
//   const img = svgCreate('image');
//   svgAttr(img, { width: 30, height: 30 });

//   // mappa tipo -> asset
//   const href =
//     guardType === 'environmental'
//       ? require('../../../icons/environmental.svg')
//       : guardType === 'position'
//         ? require('../../../icons/position.svg')
//         : guardType === 'reachability'
//           ? require('../../../icons/reachability.svg')
//           : null;

//   if (!href) return null;

//   svgAttr(img, { href });
//   img.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', href);

//   return img;
// }