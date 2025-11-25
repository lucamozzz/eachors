// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

contract Environment {
    struct Attribute {
        bool exists;
        bytes32 value;
    }

    struct PhysicalPlace {
        bool exists;
        mapping(bytes32 => Attribute) attributes;
    }
    mapping(bytes32 => PhysicalPlace) private physicalPlaces;

    struct LogicalPlace {
        bool exists;
        mapping(bytes32 => Attribute) attributes;
        string expression;
        bytes32[] physicalPlaces;
    }
    mapping(bytes32 => LogicalPlace) private logicalPlaces;

    bytes32[] private edges;

    struct View {
        bytes32[] logicalPlaces;
        mapping(bytes32 => bytes32) aggregations;
    }
    mapping(bytes32 => View) private views;

    mapping(bytes32 => bool) private reachables;
    mapping(bytes32 => bytes32[]) private paths;

    //
    // DEPLOY
    //

    constructor(
        bytes32[] memory _physicalPlaceIds,
        bytes32[][] memory _physicalPlaceAttributeKeys,
        bytes32[] memory _edgeIds,
        bytes32[] memory _logicalPlaceIds,
        string[] memory _logicalPlaceExpressions,
        bytes32[][] memory _logicalPlaceAttributeKeys,
        bytes32[] memory _viewIds,
        bytes32[][] memory _viewLogicalPlaces,
        bytes32[][] memory _viewAggregationKeys,
        bytes32[][] memory _viewAggregationValues
    ) {
        _initPhysicalPlaces(_physicalPlaceIds, _physicalPlaceAttributeKeys);
        _initEdges(_edgeIds);
        _initLogicalPlaces(
            _logicalPlaceIds,
            _logicalPlaceExpressions,
            _logicalPlaceAttributeKeys
        );
        _initViews(_viewIds, _viewLogicalPlaces, _viewAggregationKeys, _viewAggregationValues);
    }

    function _initPhysicalPlaces(
        bytes32[] memory placeIds,
        bytes32[][] memory attributeKeysList
    ) public {
        for (uint i = 0; i < placeIds.length; i++) {
            if (!physicalPlaces[placeIds[i]].exists)
                physicalPlaces[placeIds[i]].exists = true;

            for (uint j = 0; j < attributeKeysList[i].length; j++)
                physicalPlaces[placeIds[i]]
                    .attributes[attributeKeysList[i][j]]
                    .exists = true;
        }
    }

    function _initLogicalPlaces(
        bytes32[] memory _logicalPlaceIds,
        string[] memory _expressions,
        bytes32[][] memory _logicalPlaceAttributeKeys
    ) internal {
        for (uint i = 0; i < _logicalPlaceIds.length; i++) {
            if (!logicalPlaces[_logicalPlaceIds[i]].exists) {
                logicalPlaces[_logicalPlaceIds[i]].exists = true;
                logicalPlaces[_logicalPlaceIds[i]].expression = _expressions[i];
            }

            for (uint j = 0; j < _logicalPlaceAttributeKeys[i].length; j++)
                logicalPlaces[_logicalPlaceIds[i]]
                    .attributes[_logicalPlaceAttributeKeys[i][j]]
                    .exists = true;
        }
    }

    function _initEdges(bytes32[] memory _edgeIds) internal {
        edges = _edgeIds;
    }

    function _initViews(
        bytes32[] memory _viewIds,
        bytes32[][] memory _viewLogicalPlaces,
        bytes32[][] memory _viewAggregationsKeys,
        bytes32[][] memory _viewAggregationsValues
    ) internal {
        for (uint i = 0; i < _viewIds.length; i++) {
            View storage v = views[_viewIds[i]];
            v.logicalPlaces = _viewLogicalPlaces[i];
            for (uint j = 0; j < _viewAggregationsKeys[i].length; j++) {
                v.aggregations[
                    _viewAggregationsKeys[i][j]
                ] = _viewAggregationsValues[i][j];
            }
        }
    }

    //
    // OFF-CHAIN
    //

    function updatePhysicalPlaces(
        bytes32[] memory ids,
        bytes32[][] memory attributeKeysList,
        bytes32[][] memory attributeValuesList
    ) public {
        for (uint i = 0; i < ids.length; i++) {
            require(_ppKeyExists(ids[i]), "Place does not exist");

            for (uint j = 0; j < attributeKeysList[i].length; j++) {
                require(
                    _ppAttributeKeyExists(ids[i], attributeKeysList[i][j]),
                    "Attribute does not exist"
                );
                physicalPlaces[ids[i]]
                    .attributes[attributeKeysList[i][j]]
                    .value = attributeValuesList[i][j];
            }
        }
    }

    function updateLogicalPlaces(
        bytes32[] memory ids,
        bytes32[][] memory attributeKeysList,
        bytes32[][] memory attributeValuesList,
        bytes32[][] memory updatedPlacesList
    ) public {
        for (uint i = 0; i < ids.length; i++) {
            bytes32 id = ids[i];
            require(_lpKeyExists(id), "Place does not exist");

            LogicalPlace storage lp = logicalPlaces[id];

            for (uint j = 0; j < attributeKeysList[i].length; j++) {
                require(
                    _lpAttributeKeyExists(id, attributeKeysList[i][j]),
                    "Attribute does not exist"
                );
                lp
                    .attributes[attributeKeysList[i][j]]
                    .value = attributeValuesList[i][j];
            }

            lp.physicalPlaces = updatedPlacesList[i];
        }
    }

    function updateParticipantPath(
        bytes32 role,
        bytes32[] memory traversedPhysicalPlaces
    ) public {
        for (uint i = 0; i < traversedPhysicalPlaces.length; i++) {
            require(_ppKeyExists(traversedPhysicalPlaces[i]));
            paths[role].push(traversedPhysicalPlaces[i]);
        }
    }

    function updateReachables(
        bytes32[] memory conditions,
        bool[] memory values
    ) public {
        for (uint i = 0; i < conditions.length; i++)
            reachables[conditions[i]] = values[i];
    }

    //
    // CHOR
    //

    function getAttribute(
        bytes32 id,
        bytes32 attributeKey
    ) public view returns (bytes32) {
        if (_lpKeyExists(id)) {
            if (_lpAttributeKeyExists(id, attributeKey))
                return logicalPlaces[id].attributes[attributeKey].value;
            else return bytes32("Attribute does not exist!");
        } else if (_ppKeyExists(id)) {
            if (_ppAttributeKeyExists(id, attributeKey))
                return physicalPlaces[id].attributes[attributeKey].value;
            else return bytes32("Attribute does not exist!");
        } else return bytes32("Place does not exist!");
    }

    function isReachable(bytes32 conditionId) public view returns (bool) {
        return reachables[conditionId];
    }

    function getParticipantPosition(
        bytes32 role
    ) public view returns (bytes32 participantPosition) {
        return paths[role][paths[role].length - 1];
    }

    //
    // INTERNALS
    //

    function _ppKeyExists(bytes32 id) internal view returns (bool) {
        return physicalPlaces[id].exists;
    }

    function _ppAttributeKeyExists(
        bytes32 id,
        bytes32 attributeKey
    ) internal view returns (bool) {
        return physicalPlaces[id].attributes[attributeKey].exists;
    }

    function _lpKeyExists(bytes32 id) internal view returns (bool) {
        return logicalPlaces[id].exists;
    }

    function _lpAttributeKeyExists(
        bytes32 id,
        bytes32 attributeKey
    ) internal view returns (bool) {
        return logicalPlaces[id].attributes[attributeKey].exists;
    }
}
