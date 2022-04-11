// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;
import {RLPDecoder} from "./RLPDecoder.sol";

interface PolygonChildCheckPointManagerInterface {
    function getBlockHash(uint256 _blockNumber) external view returns (bytes32);
}

contract PheasantNetworkDisputeManager {
    constructor(address _checkPointManager) {
        checkPointManager = PolygonChildCheckPointManagerInterface(_checkPointManager);
    }

    PolygonChildCheckPointManagerInterface internal checkPointManager;
    bytes constant TX_TYPE2 = hex"02";
    uint256 constant ACCESSLIST = 8;

    function verifyBlockHeader(bytes32 blockHash, bytes[] calldata blockHeaderRaw) public pure returns (bool) {
        return blockHash == keccak256(rlpEncode(blockHeaderRaw, false));
    }

    function composeTx(bytes[] memory item) public pure returns (bytes memory) {
        bytes memory encodedTx = rlpEncode(item, true);
        return bytes.concat(TX_TYPE2, encodedTx);
    }

    function verifyRawTx(bytes memory transaction, bytes[] calldata txRaw) public pure returns (bool) {
        return keccak256(transaction) == keccak256(composeTx(txRaw));
    }

    function encodeBytes(bytes memory self) internal pure returns (bytes memory) {
        bytes memory encoded;
        if (self.length == 1 && uint8(self[0]) <= 128) {
            encoded = self;
        } else {
            encoded = bytes.concat(encodeLength(self.length, 128), self);
        }
        return encoded;
    }

    function encodeLength(uint256 len, uint256 offset) internal pure returns (bytes memory) {
        bytes memory encoded;
        if (len < 56) {
            encoded = new bytes(1);
            encoded[0] = bytes32(len + offset)[31];
        } else {
            uint256 lenLen;
            uint256 i = 1;
            while (len / i != 0) {
                lenLen++;
                i *= 256;
            }

            encoded = new bytes(lenLen + 1);
            encoded[0] = bytes32(lenLen + offset + 55)[31];
            for (i = 1; i <= lenLen; i++) {
                encoded[i] = bytes32((len / (256**(lenLen - i))) % 256)[31];
            }
        }
        return encoded;
    }

    function verifyBlockHash(bytes32 _blockHash, uint256 _blockNumber) public view returns (bool) {
        return checkPointManager.getBlockHash(_blockNumber) == _blockHash;
    }

    function verifyTxSignature(address from, bytes[] calldata txRaw) public pure returns (bool) {
        uint256 length = txRaw.length - 3;
        bytes[] memory unsignedRawTx = new bytes[](length);
        for (uint256 i = 0; i < length; i++) {
            unsignedRawTx[i] = txRaw[i];
        }
        bytes memory composedUnsignedTx = composeTx(unsignedRawTx);
        bytes32 message = keccak256(composedUnsignedTx);

        bytes32 r;
        bytes memory tmpR = txRaw[10];
        assembly {
            r := mload(add(tmpR, 32))
        }

        bytes32 s;
        bytes memory tmpS = txRaw[11];
        assembly {
            s := mload(add(tmpS, 32))
        }

        uint8 v = 0;
        if (keccak256(txRaw[9]) == keccak256(hex"01")) {
            v = 28;
        } else {
            v = 27;
        }

        return from == ecrecover(message, v, r, s);
    }

    function rlpEncode(bytes[] memory item, bool isTxEncode) public pure returns (bytes memory) {
        uint256 length = item.length;
        bytes memory result;
        for (uint256 i = 0; i < length; i++) {
            if (i == ACCESSLIST && isTxEncode) {
                result = bytes.concat(result, hex"c0"); //empty accessList
            } else {
                result = bytes.concat(result, encodeBytes(item[i]));
            }
        }
        bytes memory prefix = encodeLength(result.length, 192);
        return bytes.concat(prefix, result);
    }

    function checkProof(
        bytes[] memory proof,
        bytes memory bytesRoot,
        uint8[] memory path
    ) public pure returns (bytes memory) {
        bytes32 root;
        bytes memory tmpRoot = bytesRoot;
        assembly {
            root := mload(add(tmpRoot, 32))
        }

        uint256 length = proof.length;
        uint256 pathIndex = 0;
        bytes32 next;
        bytes memory encodedResult;
        require(root == keccak256(proof[0]), "Invalid Tx Root");
        for (uint256 i = 0; i < length; i++) {
            bytes[] memory result = decodeNode(proof[i]);
            if (i != 0) {
                require(keccak256(proof[i]) == next, "Invalid Proof");
            }
            if (result.length == 17) {
                if (i == length - 1) {
                    encodedResult = result[16];
                } else {
                    next = bytes32(result[path[pathIndex]]);
                    pathIndex++;
                }
            } else if (result.length == 2) {
                uint8[] memory nibble = bufferToNibble(result[0]);
                uint256 offset = 0;
                if (nibble[0] > 1) {
                    if (nibble[0] == 2) {
                        offset = 2;
                    } else if (nibble[0] == 3) {
                        offset = 1;
                    }
                    encodedResult = result[1];
                } else {
                    if (nibble[0] == 0) {
                        offset = 2;
                    } else if (nibble[0] == 1) {
                        offset = 1;
                    }
                    next = bytes32(result[1]);
                }
                for (uint256 j = offset; j < nibble.length; j++) {
                    require(path[pathIndex] == nibble[j], "Invalid Path");
                    pathIndex++;
                }
            } else {
                revert();
            }
        }
        return encodedResult;
    }

    function bufferToNibble(bytes memory buffer) internal pure returns (uint8[] memory) {
        uint256 size = buffer.length;
        uint8[] memory nibbles = new uint8[](size * 2);
        for (uint256 i = 0; i < buffer.length; i++) {
            uint256 q = i * 2;
            nibbles[q] = uint8(buffer[i] >> 4);
            ++q;
            bytes1 tmp = buffer[i] << 4;
            nibbles[q] = uint8(tmp >> 4);
        }
        return nibbles;
    }

    function decodeNode(bytes memory item) public pure returns (bytes[] memory) {
        return RLPDecoder.decode(item);
    }

    function txEcrecover(
        bytes32 hash,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) public pure returns (address) {
        return ecrecover(hash, v, r, s);
    }
}
