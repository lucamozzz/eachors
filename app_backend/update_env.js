import fs from 'fs';
import { updatePhysicalPlaces, updateLogicalPlaces, updateParticipantPath, updateReachables } from './env.js';

async function buildPhysicalPlacesArgs(env) {
  const ids = [];
  const attributeKeysList = [];
  const attributeValuesList = [];

  for (const place of env.physicalPlaces) {
    ids.push(place.name);

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
  const attributeKeysList = [];
  const attributeValuesList = [];

  for (const lp of env.logicalPlaces) {
    ids.push(lp.name);

    const keys = [];
    const values = [];
    for (const [key, value] of Object.entries(lp.attributes || {})) {
      keys.push(key);
      values.push(String(value));
    }
    attributeKeysList.push(keys);
    attributeValuesList.push(values);
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
    ['Gateway_0seo2yk_rea'],
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