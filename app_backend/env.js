import { encodeBytes32String } from 'ethers';

export async function updatePhysicalPlaces(contract, ids, attributeKeysList, attributeValuesList) {
  try {
    let nonce = await contract.runner.getNonce();
    const tx = await contract.updatePhysicalPlaces(
      ids.map(encodeBytes32String),
      attributeKeysList.map(arr => arr.map(encodeBytes32String)),
      attributeValuesList.map(arr => arr.map(encodeBytes32String)),
      { nonce: nonce++ });

    console.log('Updating physical places...');
    await tx.wait();
    console.log('Physical places updated.');
    return { success: true, txHash: tx.hash };
  } catch (err) {
    console.error('updatePhysicalPlaces error:', err);
    throw err;
  }
}

export async function updateLogicalPlaces(contract, ids, attributeKeysList, attributeValuesList) {
  try {
    let nonce = await contract.runner.getNonce();
    const tx = await contract.updateLogicalPlaces(
      ids.map(encodeBytes32String),
      attributeKeysList.map(arr => arr.map(encodeBytes32String)),
      attributeValuesList.map(arr => arr.map(encodeBytes32String)),
      { nonce: nonce++ }
    );

    console.log('Updating logical places...');
    await tx.wait();
    console.log('Logical places updated.');
    return { success: true, txHash: tx.hash };
  } catch (err) {
    console.error('updateLogicalPlaces error:', err);
    throw err;
  }
}

export async function updateParticipantPath(contract, role, traversedPhysicalPlaces) {
  try {
    let nonce = await contract.runner.getNonce();
    const tx = await contract.updateParticipantPath(
      encodeBytes32String(role),
      traversedPhysicalPlaces.map(encodeBytes32String),
      { nonce: nonce++ }
    );

    console.log('Updating participant path...');
    await tx.wait();
    console.log('Participant path updated.');
    return { success: true, txHash: tx.hash };
  } catch (err) {
    console.error('updateParticipantPath error:', err);
    throw err;
  }
}

export async function updateReachables(contract, conditions, values) {
  try {
    let nonce = await contract.runner.getNonce();
    const tx = await contract.updateReachables(
      conditions.map(encodeBytes32String),
      values,
      { nonce: nonce++ }
    );

    console.log('Updating reachables...');
    await tx.wait();
    console.log('Reachables updated.');
    return { success: true, txHash: tx.hash };
  } catch (err) {
    console.error('updateReachables error:', err);
    throw err;
  }
}