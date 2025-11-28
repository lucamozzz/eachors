import fs from 'fs';
import path from 'path';
import solc from 'solc';

export function translateContract(source) {}

function findImports(importPath) {
  try {
    const filePath = path.resolve('./contracts', importPath);
    const content = fs.readFileSync(filePath, 'utf8');
    return { contents: content };
  } catch (err) {
    return { error: 'File not found: ' + importPath };
  }
}

export function compileContract(fileName) {
  const filePath = path.resolve('./contracts', fileName);
  const source = fs.readFileSync(filePath, 'utf8');

  const input = {
    language: 'Solidity',
    sources: {
      [fileName]: { content: source },
    },
    settings: {
      outputSelection: {
        '*': { '*': ['abi', 'evm.bytecode'] },
      },
    },
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

  if (output.errors) {
    output.errors.forEach((err) => console.error(err.formattedMessage));
    if (output.errors.some((e) => e.severity === 'error')) {
      throw new Error('Compilation failed');
    }
  }

  const contractName = Object.keys(output.contracts[fileName])[0];
  const contract = output.contracts[fileName][contractName];

  return {
    abi: contract.abi,
    bytecode: contract.evm.bytecode.object,
    contractName,
  };
}