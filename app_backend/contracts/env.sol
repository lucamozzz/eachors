// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Environment {
    mapping(bytes32 => bool) private attributeExists;
    bytes32[] private attributeKeys;

    struct PhysicalPlace {
        bool exists;
        mapping(bytes32 => bytes32) attributes;
    }
    mapping(bytes32 => PhysicalPlace) private physicalPlaces;
    bytes32[] private physicalPlaceKeys;

    struct LogicalPlace {
        bool exists;
        mapping(bytes32 => bytes32) attributes;
        string expression;
    }
    mapping(bytes32 => LogicalPlace) private logicalPlaces;
    bytes32[] private logicalPlaceKeys;

    bytes32[] private edgeKeys;

    struct View {
        bytes32[] logicalPlaces;
        mapping(bytes32 => bytes32) aggregations;
    }
    mapping(bytes32 => View) private views;
    bytes32[] private viewKeys;

    mapping(bytes32 => bool) private reachables;
    mapping(bytes32 => bytes32[]) private paths;

    //
    // DEPLOY
    //

    constructor(
        bytes32[] memory _attributeKeys,
        bytes32[] memory _physicalPlaceKeys,
        bytes32[] memory _edgeKeys,
        bytes32[] memory _logicalPlaceKeys,
        string[] memory _logicalPlaceExpressions,
        bytes32[] memory _viewKeys,
        bytes32[][] memory _viewLogicalPlaces,
        bytes32[][] memory _viewAggregationKeys,
        bytes32[][] memory _viewAggregationValues
    ) {
        edgeKeys = _edgeKeys;
        _initAttributes(_attributeKeys);
        _initPhysicalPlaces(_physicalPlaceKeys);
        _initLogicalPlaces(_logicalPlaceKeys, _logicalPlaceExpressions);
        _initViews(
            _viewKeys,
            _viewLogicalPlaces,
            _viewAggregationKeys,
            _viewAggregationValues
        );
    }

    function _initAttributes(bytes32[] memory _attributeKeys) internal {
        attributeKeys = _attributeKeys;

        for (uint i = 0; i < attributeKeys.length; i++)
            attributeExists[attributeKeys[i]] = true;
    }

    function _initPhysicalPlaces(bytes32[] memory _physicalPlaceKeys) internal {
        physicalPlaceKeys = _physicalPlaceKeys;

        for (uint i = 0; i < physicalPlaceKeys.length; i++) {
            bytes32 pk = physicalPlaceKeys[i];
            physicalPlaces[pk].exists = true;

            for (uint j = 0; j < attributeKeys.length; j++)
                physicalPlaces[pk].attributes[attributeKeys[j]] = bytes32(" ");
        }
    }

    function _initLogicalPlaces(
        bytes32[] memory _logicalPlaceKeys,
        string[] memory _expressions
    ) internal {
        logicalPlaceKeys = _logicalPlaceKeys;

        for (uint i = 0; i < _logicalPlaceKeys.length; i++) {
            bytes32 id = _logicalPlaceKeys[i];
            logicalPlaces[id].exists = true;
            logicalPlaces[id].expression = _expressions[i];

            for (uint j = 0; j < attributeKeys.length; j++)
                logicalPlaces[id].attributes[attributeKeys[j]] = bytes32(" ");
        }
    }

    function _initViews(
        bytes32[] memory _viewKeys,
        bytes32[][] memory _viewLogicalPlaces,
        bytes32[][] memory _viewAggregationsKeys,
        bytes32[][] memory _viewAggregationsValues
    ) internal {
        viewKeys = _viewKeys;
        for (uint i = 0; i < _viewKeys.length; i++) {
            View storage v = views[_viewKeys[i]];
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
        bytes32[] memory keys,
        bytes32[][] memory attributeKeysList,
        bytes32[][] memory attributeValuesList
    ) public {
        for (uint i = 0; i < keys.length; i++) {
            require(_ppKeyExists(keys[i]), "Place does not exist");

            for (uint j = 0; j < attributeKeysList[i].length; j++) {
                require(
                    attributeExists[attributeKeysList[i][j]],
                    "Attribute does not exist"
                );
                physicalPlaces[keys[i]].attributes[
                    attributeKeysList[i][j]
                ] = attributeValuesList[i][j];
            }
        }
    }

    function updateLogicalPlaces(
        bytes32[] memory keys,
        bytes32[][] memory attributeKeysList,
        bytes32[][] memory attributeValuesList
    ) public {
        for (uint i = 0; i < keys.length; i++) {
            bytes32 id = keys[i];
            require(_lpKeyExists(id), "Place does not exist");

            LogicalPlace storage lp = logicalPlaces[id];

            for (uint j = 0; j < attributeKeysList[i].length; j++) {
                require(
                    attributeExists[attributeKeysList[i][j]],
                    "Attribute does not exist"
                );
                lp.attributes[attributeKeysList[i][j]] = attributeValuesList[i][
                    j
                ];
            }
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

    function getPhysicalPlaces()
        public
        view
        returns (
            bytes32[] memory _physicalPlaceKeys,
            bytes32[] memory _attributeKeys,
            bytes32[][] memory _attributeValues
        )
    {
        _physicalPlaceKeys = physicalPlaceKeys;
        _attributeKeys = attributeKeys;
        _attributeValues = new bytes32[][](
            physicalPlaceKeys.length
        );

        for (uint i = 0; i < physicalPlaceKeys.length; i++) {
            bytes32 pk = physicalPlaceKeys[i];
            bytes32[] memory attrs = new bytes32[](attributeKeys.length);

            for (uint j = 0; j < attributeKeys.length; j++) {
                attrs[j] = physicalPlaces[pk].attributes[attributeKeys[j]];
            }

            _attributeValues[i] = attrs;
        }
    }

    //
    // CHOR
    //

    function getAttribute(
        bytes32 id,
        bytes32 attributeKey
    ) public view returns (bytes32) {
        if (_lpKeyExists(id)) {
            if (attributeExists[attributeKey])
                return logicalPlaces[id].attributes[attributeKey];
            else return bytes32("Attribute does not exist!");
        } else if (_ppKeyExists(id)) {
            if (attributeExists[attributeKey])
                return physicalPlaces[id].attributes[attributeKey];
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

    function _lpKeyExists(bytes32 id) internal view returns (bool) {
        return logicalPlaces[id].exists;
    }
}
