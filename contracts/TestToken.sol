// SPDX-License-Identifier: MIT
pragma solidity >=0.4.22 <0.9.0;
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestToken  is ERC20{
  constructor(address owner) ERC20("TestToken", "TST") {
    //_mint(owner, 100000000000000000000000000);
    //_mint(address(0xE202B444Db397F53AE05149fE2843D7841A2dCBE), 100000000000000000000000000);
    _mint(address(0xb0E426B1A0B8BA474Dc5c8F6493B3E63D7121626), 100000000000000000000000000);

  }


}
