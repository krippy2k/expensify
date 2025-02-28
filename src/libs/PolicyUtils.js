import _ from 'underscore';
import lodashGet from 'lodash/get';
import Str from 'expensify-common/lib/str';
import CONST from '../CONST';
import ONYXKEYS from '../ONYXKEYS';

/**
 * Filter out the active policies, which will exclude policies with pending deletion
 * These are policies that we can use to create reports with in NewDot.
 * @param {Object} policies
 * @returns {Array}
 */
function getActivePolicies(policies) {
    return _.filter(policies, (policy) => policy && (policy.isPolicyExpenseChatEnabled || policy.areChatRoomsEnabled) && policy.pendingAction !== CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE);
}

/**
 * Checks if we have any errors stored within the POLICY_MEMBERS. Determines whether we should show a red brick road error or not.
 * Data structure: {accountID: {role:'user', errors: []}, accountID2: {role:'admin', errors: [{1231312313: 'Unable to do X'}]}, ...}
 *
 * @param {Object} policyMembers
 * @returns {Boolean}
 */
function hasPolicyMemberError(policyMembers) {
    return _.some(policyMembers, (member) => !_.isEmpty(member.errors));
}

/**
 * Check if the policy has any error fields.
 *
 * @param {Object} policy
 * @param {Object} policy.errorFields
 * @return {Boolean}
 */
function hasPolicyErrorFields(policy) {
    return _.some(lodashGet(policy, 'errorFields', {}), (fieldErrors) => !_.isEmpty(fieldErrors));
}

/**
 * Check if the policy has any errors, and if it doesn't, then check if it has any error fields.
 *
 * @param {Object} policy
 * @param {Object} policy.errors
 * @param {Object} policy.errorFields
 * @return {Boolean}
 */
function hasPolicyError(policy) {
    return !_.isEmpty(lodashGet(policy, 'errors', {})) ? true : hasPolicyErrorFields(policy);
}

/**
 * Checks if we have any errors stored within the policy custom units.
 *
 * @param {Object} policy
 * @returns {Boolean}
 */
function hasCustomUnitsError(policy) {
    return !_.isEmpty(_.pick(lodashGet(policy, 'customUnits', {}), 'errors'));
}

/**
 * @param {Number} value
 * @param {Function} toLocaleDigit
 * @returns {Number}
 */
function getNumericValue(value, toLocaleDigit) {
    const numValue = parseFloat(value.toString().replace(toLocaleDigit('.'), '.'));
    if (Number.isNaN(numValue)) {
        return NaN;
    }
    return numValue.toFixed(CONST.CUSTOM_UNITS.RATE_DECIMALS);
}

/**
 * @param {Number} value
 * @param {Function} toLocaleDigit
 * @returns {String}
 */
function getRateDisplayValue(value, toLocaleDigit) {
    const numValue = getNumericValue(value, toLocaleDigit);
    if (Number.isNaN(numValue)) {
        return '';
    }
    return numValue.toString().replace('.', toLocaleDigit('.')).substring(0, value.length);
}

/**
 * @param {Object} customUnitRate
 * @param {Number} customUnitRate.rate
 * @param {Function} toLocaleDigit
 * @returns {String}
 */
function getUnitRateValue(customUnitRate, toLocaleDigit) {
    return getRateDisplayValue(lodashGet(customUnitRate, 'rate', 0) / CONST.POLICY.CUSTOM_UNIT_RATE_BASE_OFFSET, toLocaleDigit);
}

/**
 * Get the brick road indicator status for a policy. The policy has an error status if there is a policy member error, a custom unit error or a field error.
 *
 * @param {Object} policy
 * @param {String} policy.id
 * @param {Object} policyMembersCollection
 * @returns {String}
 */
function getPolicyBrickRoadIndicatorStatus(policy, policyMembersCollection) {
    const policyMembers = lodashGet(policyMembersCollection, `${ONYXKEYS.COLLECTION.POLICY_MEMBERS}${policy.id}`, {});
    if (hasPolicyMemberError(policyMembers) || hasCustomUnitsError(policy) || hasPolicyErrorFields(policy)) {
        return CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR;
    }
    return '';
}

/**
 * Check if the policy can be displayed
 * If offline, always show the policy pending deletion.
 * If online, show the policy pending deletion only if there is an error.
 * Note: Using a local ONYXKEYS.NETWORK subscription will cause a delay in
 * updating the screen. Passing the offline status from the component.
 * @param {Object} policy
 * @param {Boolean} isOffline
 * @returns {Boolean}
 */
function shouldShowPolicy(policy, isOffline) {
    return (
        policy &&
        policy.isPolicyExpenseChatEnabled &&
        policy.role === CONST.POLICY.ROLE.ADMIN &&
        (isOffline || policy.pendingAction !== CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE || !_.isEmpty(policy.errors))
    );
}

/**
 * @param {string} email
 * @returns {boolean}
 */
function isExpensifyTeam(email) {
    const emailDomain = Str.extractEmailDomain(email);
    return emailDomain === CONST.EXPENSIFY_PARTNER_NAME || emailDomain === CONST.EMAIL.GUIDES_DOMAIN;
}

/**
 * @param {string} email
 * @returns {boolean}
 */
function isExpensifyGuideTeam(email) {
    const emailDomain = Str.extractEmailDomain(email);
    return emailDomain === CONST.EMAIL.GUIDES_DOMAIN;
}

/**
 * Checks if the current user is an admin of the policy.
 *
 * @param {Object} policy
 * @returns {Boolean}
 */
const isPolicyAdmin = (policy) => lodashGet(policy, 'role') === CONST.POLICY.ROLE.ADMIN;

/**
 *
 * @param {String} policyID
 * @param {Object} policies
 * @returns {Boolean}
 */
const isPolicyMember = (policyID, policies) => _.some(policies, (policy) => lodashGet(policy, 'id') === policyID);

/**
 * @param {Object} policyMembers
 * @param {Object} personalDetails
 * @returns {Object}
 *
 * Create an object mapping member emails to their accountIDs. Filter for members without errors, and get the login email from the personalDetail object using the accountID.
 *
 * We only return members without errors. Otherwise, the members with errors would immediately be removed before the user has a chance to read the error.
 */
function getMemberAccountIDsForWorkspace(policyMembers, personalDetails) {
    const memberEmailsToAccountIDs = {};
    _.each(policyMembers, (member, accountID) => {
        if (!_.isEmpty(member.errors)) {
            return;
        }
        const personalDetail = personalDetails[accountID];
        if (!personalDetail || !personalDetail.login) {
            return;
        }
        memberEmailsToAccountIDs[personalDetail.login] = Number(accountID);
    });
    return memberEmailsToAccountIDs;
}

/**
 * Get login list that we should not show in the workspace invite options
 *
 * @param {Object} policyMembers
 * @param {Object} personalDetails
 * @returns {Array}
 */
function getIneligibleInvitees(policyMembers, personalDetails) {
    const memberEmailsToExclude = [...CONST.EXPENSIFY_EMAILS];
    _.each(policyMembers, (policyMember, accountID) => {
        // Policy members that are pending delete or have errors are not valid and we should show them in the invite options (don't exclude them).
        if (policyMember.pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE || !_.isEmpty(policyMember.errors)) {
            return;
        }
        const memberEmail = lodashGet(personalDetails, `[${accountID}].login`);
        if (!memberEmail) {
            return;
        }
        memberEmailsToExclude.push(memberEmail);
    });

    return memberEmailsToExclude;
}

/**
 * Gets the tag from policy tags, defaults to the first if no key is provided.
 *
 * @param {Object} policyTags
 * @param {String} [tagKey]
 * @returns {Object}
 */
function getTag(policyTags, tagKey) {
    if (_.isEmpty(policyTags)) {
        return {};
    }

    const policyTagKey = tagKey || _.first(_.keys(policyTags));

    return lodashGet(policyTags, policyTagKey, {});
}

/**
 * Gets the first tag name from policy tags.
 *
 * @param {Object} policyTags
 * @returns {String}
 */
function getTagListName(policyTags) {
    if (_.isEmpty(policyTags)) {
        return '';
    }

    const policyTagKeys = _.keys(policyTags) || [];

    return lodashGet(policyTags, [_.first(policyTagKeys), 'name'], '');
}

/**
 * Gets the tags of a policy for a specific key. Defaults to the first tag if no key is provided.
 *
 * @param {Object} policyTags
 * @param {String} [tagKey]
 * @returns {String}
 */
function getTagList(policyTags, tagKey) {
    if (_.isEmpty(policyTags)) {
        return {};
    }

    const policyTagKey = tagKey || _.first(_.keys(policyTags));

    return lodashGet(policyTags, [policyTagKey, 'tags'], {});
}

/**
 * @param {Object} policy
 * @returns {Boolean}
 */
function isPendingDeletePolicy(policy) {
    return policy.pendingAction === CONST.RED_BRICK_ROAD_PENDING_ACTION.DELETE;
}

export {
    getActivePolicies,
    hasPolicyMemberError,
    hasPolicyError,
    hasPolicyErrorFields,
    hasCustomUnitsError,
    getNumericValue,
    getUnitRateValue,
    getPolicyBrickRoadIndicatorStatus,
    shouldShowPolicy,
    isExpensifyTeam,
    isExpensifyGuideTeam,
    isPolicyAdmin,
    getMemberAccountIDsForWorkspace,
    getIneligibleInvitees,
    isPolicyMember,
    getTag,
    getTagListName,
    getTagList,
    isPendingDeletePolicy,
};
