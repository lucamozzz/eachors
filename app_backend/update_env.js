import fs from 'fs';
import { updatePhysicalPlaces, updateLogicalPlaces, updateParticipantPath, updateReachables } from './env.js';

async function buildPhysicalPlacesArgs(env) {
  const ids = [];
  const attributeKeysList = [];
  const attributeValuesList = [];

  for (const place of env.physicalPlaces) {
    ids.push(place.id);

    const keys = [];
    const values = [];
    for (const [k, v] of Object.entries(place.attributes)) {
      keys.push(k);
      values.push(String(v));
    }

    attributeKeysList.push(keys);
    attributeValuesList.push(values);
  }

  return [ids, attributeKeysList, attributeValuesList];
}

async function buildLogicalPlacesArgs(env) {
  const ids = [];
  const updatedPlacesList = [];
  const attributeKeysList = [];
  const attributeValuesList = [];

  for (const lp of env.logicalPlaces) {
    ids.push(lp.id);

    const keys = [];
    const values = [];
    for (const [key, value] of Object.entries(lp.attributes || {})) {
      keys.push(key);
      values.push(String(value));
    }
    attributeKeysList.push(keys);
    attributeValuesList.push(values);

    const matchingPhysicalPlaces = env.physicalPlaces.filter(pp => {
      return lp.conditions.every(cond => {
        const attrValue = pp.attributes[cond.attribute];
        if (attrValue === undefined) return false;

        switch (cond.operator) {
        case '==':
          return String(attrValue) === String(cond.value);
        case '>':
          return Number(attrValue) > Number(cond.value);
        case '<':
          return Number(attrValue) < Number(cond.value);
        default:
          return false;
        }
      });
    });

    const physicalPlaceIds = matchingPhysicalPlaces.map(pp => pp.id);
    updatedPlacesList.push(physicalPlaceIds);
  }

  return [ids, attributeKeysList, attributeValuesList];
}

export async function updateEnv(envContract) {
  let env = JSON.parse(fs.readFileSync('./updated_env.json', 'utf-8'));
  const updatePhysicalPlacesArgs = await buildPhysicalPlacesArgs(env);
  const updateLogicalPlacesArgs = await buildLogicalPlacesArgs(env);
  const updateParticipantPathArgs = [
    'Firefighters Team',
    ['FireDepartment']
  ];
  const updateReachablesArgs = [
    ['ExclusiveGateway_0seo2yk'],
    [true]
  ];

  await updatePhysicalPlaces(envContract, updatePhysicalPlacesArgs[0], updatePhysicalPlacesArgs[1], updatePhysicalPlacesArgs[2]);
  await new Promise(resolve => setTimeout(resolve, 1000));
  await updateLogicalPlaces(envContract, updateLogicalPlacesArgs[0], updateLogicalPlacesArgs[1], updateLogicalPlacesArgs[2]);
  await new Promise(resolve => setTimeout(resolve, 1000));
  await updateParticipantPath(envContract, updateParticipantPathArgs[0], updateParticipantPathArgs[1]);
  await new Promise(resolve => setTimeout(resolve, 1000));
  await updateReachables(envContract, updateReachablesArgs[0], updateReachablesArgs[1]);
}