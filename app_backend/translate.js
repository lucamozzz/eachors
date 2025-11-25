import { ethers } from "ethers";
import fs from "fs";

// -------------------------
// LETTURA MODELLO ENVIRONMENT
// -------------------------
let env = JSON.parse(await fs.promises.readFile("./env.json", "utf-8"));
let env_updated = JSON.parse(await fs.promises.readFile("./env_updated.json", "utf-8"));

function toBytes32(string) {
    return ethers.encodeBytes32String(string);
}

const physicalPlaces = env.physicalPlaces.map(p => toBytes32(p.id));
const physicalPlacesAttributeKeys = env.physicalPlaces.map(p => Object.keys(p.attributes).map(toBytes32));
const edges = env.edges.map(e => toBytes32(e.source.split("_")[1] + "_" + e.target.split("_")[1]));
const logicalPlaces = env.logicalPlaces.map(lp => toBytes32(lp.id));
const logicalPlaceExpressions = env.logicalPlaces.map(lp => lp.conditions.map(c => `${c.attribute} ${c.operator} ${c.value}`).join(` ${lp.operator} `));
const logicalPlacesAttributeKeys = env.logicalPlaces.map(lp => Object.keys(lp.attributes).map(toBytes32));
const views = env.views.map(v => toBytes32(v.id));
const viewLogicalPlaces = env.views.map(v => v.logicalPlaces.map(toBytes32));
const viewAggregationsKeys = env.views.map(v => Object.keys(v.aggregations).map(toBytes32));
const viewAggregationsValues = env.views.map(v => Object.values(v.aggregations).map(toBytes32));
const physicalPlacesArgs = await buildPhysicalPlacesArgs(env);
const logicalPlacesArgs = await buildLogicalPlacesArgs(env);
const updatedPhysicalPlacesArgs = await buildPhysicalPlacesArgs(env_updated);
const updatedLogicalPlacesArgs = await buildLogicalPlacesArgs(env_updated);
const updateParticipantPathArgs = [
    toBytes32("Firefighters Team"),
    [toBytes32("FireDepartment")]
];
const updateReachablesArgs = [
    [toBytes32("ExclusiveGateway_0seo2yk")],
    [true]
];

async function buildPhysicalPlacesArgs(env) {
    const ids = [];
    const attributeKeysList = [];
    const attributeValuesList = [];

    for (const place of env.physicalPlaces) {
        ids.push(toBytes32(place.id));

        const keys = [];
        const values = [];
        for (const [k, v] of Object.entries(place.attributes)) {
            keys.push(toBytes32(k));
            values.push(toBytes32(String(v)));
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
        ids.push(toBytes32(lp.id));

        const keys = [];
        const values = [];
        for (const [key, value] of Object.entries(lp.attributes || {})) {
            keys.push(toBytes32(key));
            values.push(toBytes32(String(value)));
        }
        attributeKeysList.push(keys);
        attributeValuesList.push(values);

        const matchingPhysicalPlaces = env.physicalPlaces.filter(pp => {
            return lp.conditions.every(cond => {
                const attrValue = pp.attributes[cond.attribute];
                if (attrValue === undefined) return false;

                switch (cond.operator) {
                    case "==":
                        return String(attrValue) === String(cond.value);
                    case ">":
                        return Number(attrValue) > Number(cond.value);
                    case "<":
                        return Number(attrValue) < Number(cond.value);
                    default:
                        return false;
                }
            });
        });

        const physicalPlaceIds = matchingPhysicalPlaces.map(pp => toBytes32(pp.id));
        updatedPlacesList.push(physicalPlaceIds);
    }

    return [ids, attributeKeysList, attributeValuesList, updatedPlacesList];
}