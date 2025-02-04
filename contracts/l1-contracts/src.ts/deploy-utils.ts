import * as hardhat from "hardhat";
import "@nomiclabs/hardhat-ethers";
import { ethers } from "ethers";
import { SingletonFactoryFactory } from "../typechain";

export async function deployViaCreate2(
  deployWallet: ethers.Wallet,
  contractName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any[],
  create2Salt: string,
  ethTxOptions: ethers.providers.TransactionRequest,
  create2FactoryAddress: string,
  verbose: boolean = true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  libraries?: any
): Promise<[string, string]> {
  // [address, txHash]

  const contractFactory = await hardhat.ethers.getContractFactory(contractName, {
    signer: deployWallet,
    libraries,
  });
  const bytecode = contractFactory.getDeployTransaction(...[...args, ethTxOptions]).data;

  return await deployBytecodeViaCreate2(
    deployWallet,
    contractName,
    bytecode,
    create2Salt,
    ethTxOptions,
    create2FactoryAddress,
    verbose
  );
}

export async function deployBytecodeViaCreate2(
  deployWallet: ethers.Wallet,
  contractName: string,
  bytecode: ethers.BytesLike,
  create2Salt: string,
  ethTxOptions: ethers.providers.TransactionRequest,
  create2FactoryAddress: string,
  verbose: boolean = true
): Promise<[string, string]> {
  // [address, txHash]

  const log = (msg: string) => {
    if (verbose) {
      console.log(msg);
    }
  };
  log(`Deploying ${contractName}`);
  log(`create2 at {${create2FactoryAddress}}`);

  const create2Factory = SingletonFactoryFactory.connect(create2FactoryAddress, deployWallet);
  const expectedAddress = ethers.utils.getCreate2Address(
    create2Factory.address,
    create2Salt,
    ethers.utils.keccak256(bytecode)
  );

  const deployedBytecodeBefore = await deployWallet.provider.getCode(expectedAddress);
  if (ethers.utils.hexDataLength(deployedBytecodeBefore) > 0) {
    log(`Contract ${contractName} already deployed`);
    return [expectedAddress, ethers.constants.HashZero];
  }

  const tx = await create2Factory.deploy(bytecode, create2Salt, ethTxOptions);
  const receipt = await tx.wait();

  const gasUsed = receipt.gasUsed;
  log(`${contractName} deployed, gasUsed: ${gasUsed.toString()}`);
  // log(`expectedAddress: ${expectedAddress}`);
  // log(`txHash: ${tx.hash}`);

  const deployedBytecodeAfter = await deployWallet.provider.getCode(expectedAddress);
  if (ethers.utils.hexDataLength(deployedBytecodeAfter) == 0) {
    throw new Error("Failed to deploy bytecode via create2 factory");
  }

  return [expectedAddress, tx.hash];
}
