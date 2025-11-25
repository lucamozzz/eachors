// SPDX-License-Identifier: MIT
import "./env.sol";

pragma solidity ^0.8.0;

contract Chor {
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
        bytes32 rescueSiteA;
        string typeOfInjuriesA;
        uint peopleRescuedA;
        bytes32 rescueSiteG;
        bytes32 rescueSitePathG;
        bytes32[] traversedRescueSitePathG;
        string typeOfInjuriesG;
        uint peopleRescuedG;
        string emergencyType;
        string emergencyDescription;
        bytes32 emergencyLocation;
        string emergencyStatusOn;
        string emergencyStatusOff;
        string fireStatus;
        string fireStatusNR;
        string fireStatusPR;
        string damageDescriptionPR;
        bytes32[] riskLocationPR;
        bytes32 fireSite;
        bytes32 fireSitePath;
        bytes32[] traversedFireSitePath;
    }

    Element[] elements;
    StateMemory currentMemory;
    string[] elementsID = [
        "patientLocationA",
        "patientRescuedA",
        "patientReportA",
        "patientLocationG",
        "patientRescuedG",
        "patientReportG",
        "emergency",
        "emergencyOn",
        "emergencyOff",
        "fireExtinguished",
        "fireReached",
        "fireLocation",
        "fireReportPR",
        "fireReportNR",
        "EventBasedGateway_1kjkyo0",
        "ParallelGateway_1hxmsvl",
        "ExclusiveGateway_07lf73r",
        "ExclusiveGateway_0bep7fg",
        "EventBasedGateway_0e8fc2j",
        "ExclusiveGateway_0seo2yk",
        "StartEvent_1dyqrhu",
        "EndEvent_0pl0vsb",
        "EndEvent_0784xir",
        "EndEvent_09bowto",
        "EndEvent_1hk6nmw"
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

        roles["Citizen"] = payable(0x6000832cC39bDe7bdE8A0f8558c1034897512a87);
        roles["Operation Center"] = payable(
            0x6000832cC39bDe7bdE8A0f8558c1034897512a87
        );
        roles["Firefighters Team"] = payable(
            0x6000832cC39bDe7bdE8A0f8558c1034897512a87
        );
        roles["Ambulance"] = payable(
            0x6000832cC39bDe7bdE8A0f8558c1034897512a87
        );
        roles["Air Ambulance"] = payable(
            0x6000832cC39bDe7bdE8A0f8558c1034897512a87
        );

        enable("StartEvent_1dyqrhu");
        StartEvent_1dyqrhu();

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

    function patientLocationA(
        bytes32 rescueSiteA
    ) public checkMand(roleList[1]) {
        require(elements[position["patientLocationA"]].status == State.ENABLED);
        currentMemory.rescueSiteA = rescueSiteA;
        done("patientLocationA");
        enable("patientReportA");
    }

    function patientReportA(
        string memory typeOfInjuriesA,
        uint peopleRescuedA
    ) public checkMand(roleList[4]) {
        require(elements[position["patientReportA"]].status == State.ENABLED);
        require(
            environmentContract.getAttribute(
                currentMemory.emergencyLocation,
                "fireAlarm"
            ) == bytes32("false")
        );

        currentMemory.typeOfInjuriesA = typeOfInjuriesA;
        currentMemory.peopleRescuedA = peopleRescuedA;
        done("patientReportA");
        enable("ExclusiveGateway_0bep7fg");
        ExclusiveGateway_0bep7fg();
    }

    function patientLocationG(
        bytes32 rescueSiteG,
        bytes32 rescueSitePathG
    ) public checkMand(roleList[1]) {
        require(elements[position["patientLocationG"]].status == State.ENABLED);
        currentMemory.rescueSiteG = rescueSiteG;
        currentMemory.rescueSitePathG = rescueSitePathG;
        done("patientLocationG");
        enable("patientRescuedG");
    }

    function patientRescuedG(
        bytes32[] memory traversedRescueSitePathG
    ) public checkMand(roleList[3]) {
        require(elements[position["patientRescuedG"]].status == State.ENABLED);
        currentMemory.traversedRescueSitePathG = traversedRescueSitePathG;
        done("patientRescuedG");
        enable("patientReportG");
    }

    function patientReportG(
        string memory typeOfInjuriesG,
        uint peopleRescuedG
    ) public checkMand(roleList[3]) {
        require(elements[position["patientReportG"]].status == State.ENABLED);
        require(
            environmentContract.getAttribute(
                currentMemory.emergencyLocation,
                "fireAlarm"
            ) == bytes32("false")
        );

        currentMemory.typeOfInjuriesG = typeOfInjuriesG;
        currentMemory.peopleRescuedG = peopleRescuedG;
        done("patientReportG");
        enable("ExclusiveGateway_0bep7fg");
        ExclusiveGateway_0bep7fg();
    }

    function emergency(
        string memory emergencyType,
        string memory emergencyDescription,
        bytes32 emergencyLocation
    ) public checkMand(roleList[0]) {
        require(elements[position["emergency"]].status == State.ENABLED);
        currentMemory.emergencyType = emergencyType;
        currentMemory.emergencyDescription = emergencyDescription;
        currentMemory.emergencyLocation = emergencyLocation;
        done("emergency");
        enable("EventBasedGateway_0e8fc2j");
        EventBasedGateway_0e8fc2j();
    }

    function emergencyOn(
        string memory emergencyStatusOn
    ) public checkMand(roleList[1]) {
        require(elements[position["emergencyOn"]].status == State.ENABLED);
        currentMemory.emergencyStatusOn = emergencyStatusOn;
        done("emergencyOn");
        disable("emergencyOff");
        enable("fireLocation");
    }

    function emergencyOff(
        string memory emergencyStatusOff
    ) public checkMand(roleList[1]) {
        require(elements[position["emergencyOff"]].status == State.ENABLED);
        currentMemory.emergencyStatusOff = emergencyStatusOff;
        done("emergencyOff");
        disable("emergencyOn");
        enable("EndEvent_1hk6nmw");
        EndEvent_1hk6nmw();
    }

    function fireExtinguished(
        string memory fireStatus
    ) public checkMand(roleList[2]) {
        require(elements[position["fireExtinguished"]].status == State.ENABLED);
        currentMemory.fireStatus = fireStatus;
        done("fireExtinguished");
        enable("EventBasedGateway_1kjkyo0");
        EventBasedGateway_1kjkyo0();
    }

    function fireReached(
        bytes32[] memory traversedFireSitePath
    ) public checkMand(roleList[2]) {
        require(elements[position["fireReached"]].status == State.ENABLED);
        currentMemory.traversedFireSitePath = traversedFireSitePath;
        done("fireReached");
        enable("ParallelGateway_1hxmsvl");
        ParallelGateway_1hxmsvl();
    }

    function fireLocation(
        bytes32 fireSite,
        bytes32 fireSitePath
    ) public checkMand(roleList[1]) {
        require(elements[position["fireLocation"]].status == State.ENABLED);
        currentMemory.fireSite = fireSite;
        currentMemory.fireSitePath = fireSitePath;
        done("fireLocation");
        enable("fireReached");
    }

    function fireReportPR(
        string memory fireStatusPR,
        string memory damageDescriptionPR,
        bytes32[] memory riskLocationPR
    ) public checkMand(roleList[2]) {
        require(elements[position["fireReportPR"]].status == State.ENABLED);
        require(
            environmentContract.getParticipantPosition("Firefighters Team") ==
                "FireDepartment"
        );

        currentMemory.fireStatusPR = fireStatusPR;
        currentMemory.damageDescriptionPR = damageDescriptionPR;
        currentMemory.riskLocationPR = riskLocationPR;
        done("fireReportPR");
        enable("EndEvent_0784xir");
        EndEvent_0784xir();
    }

    function fireReportNR(
        string memory fireStatusNR
    ) public checkMand(roleList[2]) {
        require(elements[position["fireReportNR"]].status == State.ENABLED);
        currentMemory.fireStatusNR = fireStatusNR;
        done("fireReportNR");
        enable("EndEvent_0pl0vsb");
        EndEvent_0pl0vsb();
    }

    function EventBasedGateway_1kjkyo0() private {
        require(
            elements[position["EventBasedGateway_1kjkyo0"]].status ==
                State.ENABLED
        );
        done("EventBasedGateway_1kjkyo0");
        enable("fireReportPR");
        enable("fireReportNR");
    }

    function ParallelGateway_1hxmsvl() private {
        require(
            elements[position["ParallelGateway_1hxmsvl"]].status ==
                State.ENABLED
        );
        done("ParallelGateway_1hxmsvl");
        enable("fireExtinguished");
        enable("ExclusiveGateway_07lf73r");
        ExclusiveGateway_07lf73r();
    }

    function ExclusiveGateway_07lf73r() private {
        require(
            elements[position["ExclusiveGateway_07lf73r"]].status ==
                State.ENABLED
        );
        done("ExclusiveGateway_07lf73r");
        if (
            environmentContract.getAttribute(
                currentMemory.fireSite,
                "people"
            ) == bytes32(uint256(0))
        ) {
            enable("ExclusiveGateway_0bep7fg");
            ExclusiveGateway_0bep7fg();
        } else if (
            environmentContract.getAttribute(currentMemory.fireSite, "people") >
            bytes32(uint256(0))
        ) {
            enable("ExclusiveGateway_0seo2yk");
            ExclusiveGateway_0seo2yk();
        }
    }

    function ExclusiveGateway_0bep7fg() private {
        require(
            elements[position["ExclusiveGateway_0bep7fg"]].status ==
                State.ENABLED
        );
        done("ExclusiveGateway_0bep7fg");
        enable("EndEvent_09bowto");
        EndEvent_09bowto();
    }

    function EventBasedGateway_0e8fc2j() private {
        require(
            elements[position["EventBasedGateway_0e8fc2j"]].status ==
                State.ENABLED
        );
        done("EventBasedGateway_0e8fc2j");
        enable("emergencyOn");
        enable("emergencyOff");
    }

    function ExclusiveGateway_0seo2yk() private {
        require(
            elements[position["ExclusiveGateway_0seo2yk"]].status ==
                State.ENABLED
        );
        done("ExclusiveGateway_0seo2yk");

        if (environmentContract.isReachable("ExclusiveGateway_0seo2yk") == true)
            enable("patientLocationG");
        else if (
            environmentContract.isReachable("ExclusiveGateway_0seo2yk") == false
        ) enable("patientLocationA");
    }

    function StartEvent_1dyqrhu() private {
        require(
            elements[position["StartEvent_1dyqrhu"]].status == State.ENABLED
        );
        done("StartEvent_1dyqrhu");
        enable("emergency");
    }

    function EndEvent_0pl0vsb() private {
        require(elements[position["EndEvent_0pl0vsb"]].status == State.ENABLED);
        done("EndEvent_0pl0vsb");
    }

    function EndEvent_0784xir() private {
        require(elements[position["EndEvent_0784xir"]].status == State.ENABLED);
        done("EndEvent_0784xir");
    }

    function EndEvent_09bowto() private {
        require(elements[position["EndEvent_09bowto"]].status == State.ENABLED);
        done("EndEvent_09bowto");
    }

    function EndEvent_1hk6nmw() private {
        require(elements[position["EndEvent_1hk6nmw"]].status == State.ENABLED);
        done("EndEvent_1hk6nmw");
    }
}
