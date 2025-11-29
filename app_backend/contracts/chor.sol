// SPDX-License-Identifier: MIT
import "./env.sol";

pragma solidity ^0.8.0;

contract chor {
    event functionDone(string);

    Environment public environmentContract;

    mapping(string => uint) position;
    mapping(string => address payable) roles;

    enum State {
        DISABLED,
        ENABLED,
        DONE
    }

    struct Element {
        string ID;
        State status;
    }

    struct StateMemory {
        string fireStatusNR;
        string fireStatusPR;
        string damageDescription;
        bytes32[] riskLocations;
        bytes32 rescueSiteG;
        bytes32 rescueSitePathG;
        bytes32[] traversedRescueSitePath;
        string typeOfInjuriesG;
        uint peopleRescuedG;
        bytes32[] traversedFireSitePath;
        bytes32 fireSite;
        bytes32 fireSitePath;
        string fireStatus;
        string emergencyType;
        string emergencyDescription;
        bytes32 emergencyLocation;
        string emergencyStatusOff;
        string emergencyStatusOn;
        bytes32 rescueSiteA;
        string typeOfInjuriesA;
        uint peopleRescuedA;
    }

    Element[] elements;
    StateMemory currentMemory;
    string[] elementsID = [
        "Event_1dyqrhu",
        "Event_0pl0vsb",
        "Event_0784xir",
        "Event_09bowto",
        "Event_1hk6nmw",
        "fireReportNR",
        "fireReportPR",
        "rescueLocationG",
        "peopleRescued",
        "rescueReportG",
        "fireReached",
        "fireLocation",
        "fireExtinguished",
        "emergency",
        "emergencyOff",
        "emergencyOn",
        "rescueLocationA",
        "rescueReportA",
        "Gateway_1kjkyo0",
        "Gateway_0e8fc2j",
        "Gateway_1hxmsvl",
        "Gateway_07lf73r_env",
        "Gateway_0bep7fg",
        "Gateway_0seo2yk_rea"
    ];
    string[] roleList = [
        "Citizen",
        "Operation Center",
        "Firefighters Team",
        "Ambulance",
        "Air Ambulance"
    ];

    constructor(address environmentAddress) {
        for (uint i = 0; i < elementsID.length; i++) {
            elements.push(Element(elementsID[i], State.DISABLED));
            position[elementsID[i]] = i;
        }

        environmentContract = Environment(environmentAddress);

        roles["Citizen"] = payable(0xdBC004826C17F7f8938271fA64c11338b50eebf6);
        roles["Operation Center"] = payable(0xdBC004826C17F7f8938271fA64c11338b50eebf6);
        roles["Firefighters Team"] = payable(0xdBC004826C17F7f8938271fA64c11338b50eebf6);
        roles["Ambulance"] = payable(0xdBC004826C17F7f8938271fA64c11338b50eebf6);
        roles["Air Ambulance"] = payable(0xdBC004826C17F7f8938271fA64c11338b50eebf6);

        enable("Event_1dyqrhu");
        Event_1dyqrhu();

        emit functionDone("Contract creation");
    }

    modifier checkMand(string memory role) {
        require(msg.sender == roles[role]);
        _;
    }

    function enable(string memory _taskID) internal {
        elements[position[_taskID]].status = State.ENABLED;
    }

    function disable(string memory _taskID) internal {
        elements[position[_taskID]].status = State.DISABLED;
    }

    function done(string memory _taskID) internal {
        elements[position[_taskID]].status = State.DONE;
        emit functionDone(_taskID);
    }

    function getCurrentState()
        public
        view
        returns (Element[] memory, StateMemory memory)
    {
        return (elements, currentMemory);
    }

    function Event_0pl0vsb() private {
        require(elements[position["Event_0pl0vsb"]].status == State.ENABLED);
        done("Event_0pl0vsb");
    }

    function Event_0784xir() private {
        require(elements[position["Event_0784xir"]].status == State.ENABLED);
        done("Event_0784xir");
    }

    function Event_09bowto() private {
        require(elements[position["Event_09bowto"]].status == State.ENABLED);
        done("Event_09bowto");
    }

    function Event_1hk6nmw() private {
        require(elements[position["Event_1hk6nmw"]].status == State.ENABLED);
        done("Event_1hk6nmw");
    }

    function fireReportNR(
        string memory fireStatusNR
    ) public checkMand(roleList[2]) {
        require(elements[position["fireReportNR"]].status == State.ENABLED);
        currentMemory.fireStatusNR = fireStatusNR;
        done("fireReportNR");
        enable("Event_0pl0vsb");
        Event_0pl0vsb();
    }


    function fireReportPR(
        string memory fireStatusPR, string memory damageDescription, bytes32[] memory riskLocations
    ) public checkMand(roleList[2]) {
        require(elements[position["fireReportPR"]].status == State.ENABLED);
        require(
            environmentContract.getParticipantPosition("Firefighters Team") ==
                "FireDepartment"
        );

        currentMemory.fireStatusPR = fireStatusPR;
        currentMemory.damageDescription = damageDescription;
        currentMemory.riskLocations = riskLocations;
        done("fireReportPR");
        enable("Event_0784xir");
        Event_0784xir();
    }


    function rescueLocationG(
        bytes32 rescueSiteG, bytes32 rescueSitePathG
    ) public checkMand(roleList[1]) {
        require(elements[position["rescueLocationG"]].status == State.ENABLED);
        currentMemory.rescueSiteG = rescueSiteG;
        currentMemory.rescueSitePathG = rescueSitePathG;
        done("rescueLocationG");
        enable("peopleRescued");
    }

    function peopleRescued(
        bytes32[] memory traversedRescueSitePath
    ) public checkMand(roleList[1]) {
        require(elements[position["peopleRescued"]].status == State.ENABLED);
        currentMemory.traversedRescueSitePath = traversedRescueSitePath;
        done("peopleRescued");
        enable("rescueReportG");
    }


    function rescueReportG(
        string memory typeOfInjuriesG, uint peopleRescuedG
    ) public checkMand(roleList[3]) {
        require(elements[position["rescueReportG"]].status == State.ENABLED);
        require(
            environmentContract.getAttribute(
                currentMemory.fireSite,
                "fire"
            ) == bytes32("false")
        );

        currentMemory.typeOfInjuriesG = typeOfInjuriesG;
        currentMemory.peopleRescuedG = peopleRescuedG;
        done("rescueReportG");
        enable("Gateway_0bep7fg");
        Gateway_0bep7fg();
    }


    function fireReached(
        bytes32[] memory traversedFireSitePath
    ) public checkMand(roleList[1]) {
        require(elements[position["fireReached"]].status == State.ENABLED);
        currentMemory.traversedFireSitePath = traversedFireSitePath;
        done("fireReached");
        enable("Gateway_1hxmsvl");
        Gateway_1hxmsvl();
    }

    function fireLocation(
        bytes32 fireSite, bytes32 fireSitePath
    ) public checkMand(roleList[1]) {
        require(elements[position["fireLocation"]].status == State.ENABLED);
        currentMemory.fireSite = fireSite;
        currentMemory.fireSitePath = fireSitePath;
        done("fireLocation");
        enable("fireReached");
    }


    function fireExtinguished(
        string memory fireStatus
    ) public checkMand(roleList[2]) {
        require(elements[position["fireExtinguished"]].status == State.ENABLED);
        currentMemory.fireStatus = fireStatus;
        done("fireExtinguished");
        enable("Gateway_1kjkyo0");
        Gateway_1kjkyo0();
    }


    function emergency(
        string memory emergencyType, string memory emergencyDescription, bytes32 emergencyLocation
    ) public checkMand(roleList[0]) {
        require(elements[position["emergency"]].status == State.ENABLED);
        currentMemory.emergencyType = emergencyType;
        currentMemory.emergencyDescription = emergencyDescription;
        currentMemory.emergencyLocation = emergencyLocation;
        done("emergency");
        enable("Gateway_0e8fc2j");
        Gateway_0e8fc2j();
    }


    function emergencyOff(
        string memory emergencyStatusOff
    ) public checkMand(roleList[1]) {
        require(elements[position["emergencyOff"]].status == State.ENABLED);
        currentMemory.emergencyStatusOff = emergencyStatusOff;
        done("emergencyOff");
        enable("Event_1hk6nmw");
        Event_1hk6nmw();
    }


    function emergencyOn(
        string memory emergencyStatusOn
    ) public checkMand(roleList[1]) {
        require(elements[position["emergencyOn"]].status == State.ENABLED);
        currentMemory.emergencyStatusOn = emergencyStatusOn;
        done("emergencyOn");
        enable("fireLocation");
    }


    function rescueLocationA(
        bytes32 rescueSiteA
    ) public checkMand(roleList[1]) {
        require(elements[position["rescueLocationA"]].status == State.ENABLED);
        currentMemory.rescueSiteA = rescueSiteA;
        done("rescueLocationA");
        enable("rescueReportA");
    }


    function rescueReportA(
        string memory typeOfInjuriesA, uint peopleRescuedA
    ) public checkMand(roleList[4]) {
        require(elements[position["rescueReportA"]].status == State.ENABLED);
        require(
            environmentContract.getAttribute(
                currentMemory.fireSite,
                "fire"
            ) == bytes32("false")
        );

        currentMemory.typeOfInjuriesA = typeOfInjuriesA;
        currentMemory.peopleRescuedA = peopleRescuedA;
        done("rescueReportA");
        enable("Gateway_0bep7fg");
        Gateway_0bep7fg();
    }


    function Gateway_1kjkyo0() private {
        require(
            elements[position["Gateway_1kjkyo0"]].status ==
                State.ENABLED
        );
        done("Gateway_1kjkyo0");
        enable("fireReportPR");
        enable("fireReportNR");
    }


    function Gateway_0e8fc2j() private {
        require(
            elements[position["Gateway_0e8fc2j"]].status ==
                State.ENABLED
        );
        done("Gateway_0e8fc2j");
        enable("emergencyOn");
        enable("emergencyOff");
    }


    function Gateway_1hxmsvl() private {
        require(
            elements[position["Gateway_1hxmsvl"]].status ==
                State.ENABLED
        );
        done("Gateway_1hxmsvl");
        enable("fireExtinguished");
        enable("Gateway_07lf73r_env");
        Gateway_07lf73r_env();
    }


    function Gateway_07lf73r_env() private {
        require(
            elements[position["Gateway_07lf73r_env"]].status ==
                State.ENABLED
        );
        done("Gateway_07lf73r_env");
        if (
            environmentContract.getAttribute(currentMemory.fireSite, "people") == bytes32(uint256(0))
        ) {
            enable("Gateway_0bep7fg");
            Gateway_0bep7fg();
        }
        else if (
            environmentContract.getAttribute(currentMemory.fireSite, "people") > bytes32(uint256(0))
        ) {
            enable("Gateway_0seo2yk_rea");
            Gateway_0seo2yk_rea();
        }
    }


    function Gateway_0bep7fg() private {
        require(
            elements[position["Gateway_0bep7fg"]].status ==
                State.ENABLED
        );
        done("Gateway_0bep7fg");
        enable("Event_09bowto");
        Event_09bowto();
    }


    function Gateway_0seo2yk_rea() private {
        require(
            elements[position["Gateway_0seo2yk_rea"]].status ==
                State.ENABLED
        );
        done("Gateway_0seo2yk_rea");
        if (
            environmentContract.isReachable("Gateway_0seo2yk_rea") == false
        ) {
            enable("rescueLocationA");
        }
        else if (
            environmentContract.isReachable("Gateway_0seo2yk_rea") == true
        ) {
            enable("rescueLocationG");
        }
    }


    function Event_1dyqrhu() private {
      require(
          elements[position["Event_1dyqrhu"]].status == State.ENABLED
      );
      done("Event_1dyqrhu");
      enable("emergency");
  }


}