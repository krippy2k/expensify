import React, {useEffect, useMemo, useState} from 'react';
import {View} from 'react-native';
import PropTypes from 'prop-types';
import _ from 'underscore';
import {withOnyx} from 'react-native-onyx';
import ONYXKEYS from '../../../../ONYXKEYS';
import styles from '../../../../styles/styles';
import OptionsSelector from '../../../../components/OptionsSelector';
import * as OptionsListUtils from '../../../../libs/OptionsListUtils';
import * as ReportUtils from '../../../../libs/ReportUtils';
import CONST from '../../../../CONST';
import withLocalize, {withLocalizePropTypes} from '../../../../components/withLocalize';
import compose from '../../../../libs/compose';
import personalDetailsPropType from '../../../personalDetailsPropType';
import reportPropTypes from '../../../reportPropTypes';
import avatarPropTypes from '../../../../components/avatarPropTypes';

const propTypes = {
    /** Beta features list */
    betas: PropTypes.arrayOf(PropTypes.string),

    /** Callback to inform parent modal of success */
    onStepComplete: PropTypes.func.isRequired,

    /** Callback to add participants in MoneyRequestModal */
    onAddParticipants: PropTypes.func.isRequired,

    /** Selected participants from MoneyRequestModal with login */
    participants: PropTypes.arrayOf(
        PropTypes.shape({
            login: PropTypes.string.isRequired,
            alternateText: PropTypes.string,
            hasDraftComment: PropTypes.bool,
            icons: PropTypes.arrayOf(avatarPropTypes),
            searchText: PropTypes.string,
            text: PropTypes.string,
            keyForList: PropTypes.string,
            reportID: PropTypes.string,
        }),
    ),

    /** All of the personal details for everyone */
    personalDetails: PropTypes.objectOf(personalDetailsPropType),

    /** All reports shared with the user */
    reports: PropTypes.objectOf(reportPropTypes),

    /** padding bottom style of safe area */
    safeAreaPaddingBottomStyle: PropTypes.oneOfType([PropTypes.arrayOf(PropTypes.object), PropTypes.object]),

    ...withLocalizePropTypes,
};

const defaultProps = {
    participants: [],
    betas: [],
    personalDetails: {},
    reports: {},
    safeAreaPaddingBottomStyle: {},
};

function MoneyRequestParticipantsSplitSelector(props) {
    const [searchTerm, setSearchTerm] = useState('');
    const [newChatOptions, setNewChatOptions] = useState({
        recentReports: [],
        personalDetails: [],
        userToInvite: null,
    });

    function updateOptionsWithSearchTerm (newSearchTerm = '') {
        const {recentReports, personalDetails, userToInvite} = OptionsListUtils.getNewChatOptions(
            props.reports,
            props.personalDetails,
            props.betas,
            newSearchTerm,
            props.participants,
            CONST.EXPENSIFY_EMAILS,
        );
        setSearchTerm(newSearchTerm);
        setNewChatOptions({
            recentReports,
            personalDetails,
            userToInvite
        });
    }

    const maxParticipantsReached = props.participants.length === CONST.REPORT.MAXIMUM_PARTICIPANTS;

    /**
     * Returns the sections needed for the OptionsSelector
     *
     * @param {Boolean} maxParticipantsReached
     * @returns {Array}
     */
    const sections = useMemo(() => {
        const newSections = [];
        let indexOffset = 0;

        newSections.push({
            title: undefined,
            data: props.participants,
            shouldShow: true,
            indexOffset,
        });
        indexOffset += props.participants.length;

        if (maxParticipantsReached) {
            return newSections;
        }

        const {
            recentReports,
            personalDetails,
            userToInvite
        } = newChatOptions;

        newSections.push({
            title: props.translate('common.recents'),
            data: recentReports,
            shouldShow: !_.isEmpty(recentReports),
            indexOffset,
        });
        indexOffset += recentReports.length;

        newSections.push({
            title: props.translate('common.contacts'),
            data: personalDetails,
            shouldShow: !_.isEmpty(personalDetails),
            indexOffset,
        });
        indexOffset += personalDetails.length;

        if (userToInvite && !OptionsListUtils.isCurrentUser(userToInvite)) {
            newSections.push({
                undefined,
                data: [userToInvite],
                shouldShow: true,
                indexOffset,
            });
        }

        return newSections;
    }, [props.translate, props.participants, newChatOptions, maxParticipantsReached])

    /**
     * Removes a selected option from list if already selected. If not already selected add this option to the list.
     * @param {Object} option
     */
    function toggleOption(option) {
        const isOptionInList = _.some(props.participants, (selectedOption) => selectedOption.login === option.login);

        let newSelectedOptions;

        if (isOptionInList) {
            newSelectedOptions = _.reject(props.participants, (selectedOption) => selectedOption.login === option.login);
        } else {
            newSelectedOptions = [...props.participants, option];
        }

        const {recentReports, personalDetails, userToInvite} = OptionsListUtils.getNewChatOptions(
            props.reports,
            props.personalDetails,
            props.betas,
            isOptionInList ? searchTerm : '',
            newSelectedOptions,
            CONST.EXPENSIFY_EMAILS,
        );

        setNewChatOptions({
            recentReports,
            personalDetails,
            userToInvite
        });
        props.onAddParticipants(newSelectedOptions)
    }

    /**
     * Once a single or more users are selected, navigates to next step
     */
    function finalizeParticipants() {
        props.onStepComplete();
    }

    const headerMessage = OptionsListUtils.getHeaderMessage(
        newChatOptions.personalDetails.length + newChatOptions.recentReports.length !== 0,
        Boolean(newChatOptions.userToInvite),
        searchTerm,
        maxParticipantsReached,
    );
    const isOptionsDataReady = ReportUtils.isReportDataReady() && OptionsListUtils.isPersonalDetailsReady(props.personalDetails);

    useEffect(() => {
        updateOptionsWithSearchTerm(searchTerm);
    }, [props.reports, props.personalDetails, searchTerm])

    return (
        <View style={[styles.flex1, styles.w100, props.participants.length > 0 ? props.safeAreaPaddingBottomStyle : {}]}>
            <OptionsSelector
                canSelectMultipleOptions
                sections={sections}
                selectedOptions={props.participants}
                value={searchTerm}
                onSelectRow={toggleOption}
                onChangeText={setSearchTerm}
                headerMessage={headerMessage}
                boldStyle
                shouldShowConfirmButton
                confirmButtonText={props.translate('common.next')}
                onConfirmSelection={finalizeParticipants}
                textInputLabel={props.translate('optionsSelector.nameEmailOrPhoneNumber')}
                safeAreaPaddingBottomStyle={props.safeAreaPaddingBottomStyle}
                shouldShowOptions={isOptionsDataReady}
            />
        </View>
    );
};

MoneyRequestParticipantsSplitSelector.propTypes = propTypes;
MoneyRequestParticipantsSplitSelector.defaultProps = defaultProps;
MoneyRequestParticipantsSplitSelector.displayName = 'MoneyRequestParticipantsSplitSelector';

export default compose(
    withLocalize,
    withOnyx({
        personalDetails: {
            key: ONYXKEYS.PERSONAL_DETAILS,
        },
        reports: {
            key: ONYXKEYS.COLLECTION.REPORT,
        },
        betas: {
            key: ONYXKEYS.BETAS,
        },
    }),
)(MoneyRequestParticipantsSplitSelector);
