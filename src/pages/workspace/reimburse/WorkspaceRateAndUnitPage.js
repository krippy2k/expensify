import React from 'react';
import {Keyboard, View} from 'react-native';
import _ from 'underscore';
import lodashGet from 'lodash/get';
import {withOnyx} from 'react-native-onyx';
import ONYXKEYS from '../../../ONYXKEYS';
import withLocalize, {withLocalizePropTypes} from '../../../components/withLocalize';
import styles from '../../../styles/styles';
import compose from '../../../libs/compose';
import * as Policy from '../../../libs/actions/Policy';
import * as PolicyUtils from '../../../libs/PolicyUtils';
import CONST from '../../../CONST';
import Picker from '../../../components/Picker';
import TextInput from '../../../components/TextInput';
import WorkspacePageWithSections from '../WorkspacePageWithSections';
import withPolicy, {policyPropTypes, policyDefaultProps} from '../withPolicy';
import {withNetwork} from '../../../components/OnyxProvider';
import OfflineWithFeedback from '../../../components/OfflineWithFeedback';
import Form from '../../../components/Form';
import Navigation from '../../../libs/Navigation/Navigation';
import ROUTES from '../../../ROUTES';
import getPermittedDecimalSeparator from '../../../libs/getPermittedDecimalSeparator';
import * as BankAccounts from '../../../libs/actions/BankAccounts';
import * as ReimbursementAccountProps from '../../ReimbursementAccount/reimbursementAccountPropTypes';
import * as NumberUtils from '../../../libs/NumberUtils';

const propTypes = {
    /** Bank account attached to free plan */
    reimbursementAccount: ReimbursementAccountProps.reimbursementAccountPropTypes,

    ...policyPropTypes,
    ...withLocalizePropTypes,
};

const defaultProps = {
    reimbursementAccount: {},
    ...policyDefaultProps,
};

class WorkspaceRateAndUnitPage extends React.Component {
    constructor(props) {
        super(props);
        this.submit = this.submit.bind(this);
        this.validate = this.validate.bind(this);

        this.state = {
            rate: 0,
            unit: CONST.CUSTOM_UNITS.DISTANCE_UNIT_MILES,
        };
    }

    componentDidMount() {
        this.resetRateAndUnit();

        if (lodashGet(this.props, 'policy.customUnits', []).length !== 0) {
            return;
        }
        // When this page is accessed directly from url, the policy.customUnits data won't be available,
        // and we should trigger Policy.openWorkspaceReimburseView to get the data

        BankAccounts.setReimbursementAccountLoading(true);
        Policy.openWorkspaceReimburseView(this.props.policy.id);
    }

    componentDidUpdate(prevProps) {
        // We should update rate input when rate data is fetched
        if (prevProps.reimbursementAccount.isLoading === this.props.reimbursementAccount.isLoading) {
            return;
        }

        this.resetRateAndUnit();
    }

    getUnitItems() {
        return [
            {label: this.props.translate('common.kilometers'), value: CONST.CUSTOM_UNITS.DISTANCE_UNIT_KILOMETERS},
            {label: this.props.translate('common.miles'), value: CONST.CUSTOM_UNITS.DISTANCE_UNIT_MILES},
        ];
    }

    getRateDisplayValue(value) {
        const numValue = this.getNumericValue(value);
        if (Number.isNaN(numValue)) {
            return '';
        }
        return numValue.toString().replace('.', this.props.toLocaleDigit('.')).substring(0, value.length);
    }

    getNumericValue(value) {
        const numValue = NumberUtils.parseFloatAnyLocale(value.toString());
        if (Number.isNaN(numValue)) {
            return NaN;
        }
        return numValue.toFixed(3);
    }

    resetRateAndUnit() {
        const distanceCustomUnit = _.find(lodashGet(this.props, 'policy.customUnits', {}), (unit) => unit.name === CONST.CUSTOM_UNITS.NAME_DISTANCE);
        const distanceCustomRate = _.find(lodashGet(distanceCustomUnit, 'rates', {}), (rate) => rate.name === CONST.CUSTOM_UNITS.DEFAULT_RATE);

        this.setState({
            rate: PolicyUtils.getUnitRateValue(distanceCustomRate, this.props.toLocaleDigit),
            unit: lodashGet(distanceCustomUnit, 'attributes.unit', CONST.CUSTOM_UNITS.DISTANCE_UNIT_MILES),
        });
    }

    saveUnitAndRate(unit, rate) {
        const distanceCustomUnit = _.find(lodashGet(this.props, 'policy.customUnits', {}), (u) => u.name === CONST.CUSTOM_UNITS.NAME_DISTANCE);
        if (!distanceCustomUnit) {
            return;
        }
        const currentCustomUnitRate = _.find(lodashGet(distanceCustomUnit, 'rates', {}), (r) => r.name === CONST.CUSTOM_UNITS.DEFAULT_RATE);
        const unitID = lodashGet(distanceCustomUnit, 'customUnitID', '');
        const unitName = lodashGet(distanceCustomUnit, 'name', '');
        const rateNumValue = PolicyUtils.getNumericValue(rate, this.props.toLocaleDigit);

        const newCustomUnit = {
            customUnitID: unitID,
            name: unitName,
            attributes: {unit},
            rates: {
                ...currentCustomUnitRate,
                rate: rateNumValue * CONST.POLICY.CUSTOM_UNIT_RATE_BASE_OFFSET,
            },
        };
        Policy.updateWorkspaceCustomUnitAndRate(this.props.policy.id, distanceCustomUnit, newCustomUnit, this.props.policy.lastModified);
    }

    submit() {
        this.saveUnitAndRate(this.state.unit, this.state.rate);
        Keyboard.dismiss();
        Navigation.goBack(ROUTES.WORKSPACE_REIMBURSE.getRoute(this.props.policy.id));
    }

    validate(values) {
        const errors = {};
        const decimalSeparator = this.props.toLocaleDigit('.');
        const rateValueRegex = RegExp(String.raw`^-?\d{0,8}([${getPermittedDecimalSeparator(decimalSeparator)}]\d{1,3})?$`, 'i');
        if (!rateValueRegex.test(values.rate) || values.rate === '') {
            errors.rate = 'workspace.reimburse.invalidRateError';
        } else if (NumberUtils.parseFloatAnyLocale(values.rate) <= 0) {
            errors.rate = 'workspace.reimburse.lowRateError';
        }
        return errors;
    }

    render() {
        const distanceCustomUnit = _.find(lodashGet(this.props, 'policy.customUnits', {}), (unit) => unit.name === CONST.CUSTOM_UNITS.NAME_DISTANCE);
        const distanceCustomRate = _.find(lodashGet(distanceCustomUnit, 'rates', {}), (rate) => rate.name === CONST.CUSTOM_UNITS.DEFAULT_RATE);
        return (
            <WorkspacePageWithSections
                headerText={this.props.translate('workspace.reimburse.trackDistance')}
                route={this.props.route}
                guidesCallTaskID={CONST.GUIDES_CALL_TASK_IDS.WORKSPACE_REIMBURSE}
                shouldSkipVBBACall
                backButtonRoute={ROUTES.WORKSPACE_REIMBURSE.getRoute(this.props.policy.id)}
            >
                {() => (
                    <Form
                        formID={ONYXKEYS.FORMS.WORKSPACE_RATE_AND_UNIT_FORM}
                        submitButtonText={this.props.translate('common.save')}
                        style={[styles.mh5, styles.flexGrow1]}
                        scrollContextEnabled
                        validate={this.validate}
                        onSubmit={this.submit}
                        enabledWhenOffline
                    >
                        <OfflineWithFeedback
                            errors={{
                                ...lodashGet(distanceCustomUnit, 'errors', {}),
                                ...lodashGet(distanceCustomRate, 'errors', {}),
                            }}
                            pendingAction={lodashGet(distanceCustomUnit, 'pendingAction') || lodashGet(distanceCustomRate, 'pendingAction')}
                            onClose={() =>
                                Policy.clearCustomUnitErrors(this.props.policy.id, lodashGet(distanceCustomUnit, 'customUnitID', ''), lodashGet(distanceCustomRate, 'customUnitRateID', ''))
                            }
                        >
                            <TextInput
                                accessibilityRole={CONST.ACCESSIBILITY_ROLE.TEXT}
                                inputID="rate"
                                containerStyles={[styles.mt4]}
                                defaultValue={PolicyUtils.getUnitRateValue(distanceCustomRate, this.props.toLocaleDigit)}
                                label={this.props.translate('workspace.reimburse.trackDistanceRate')}
                                accessibilityLabel={this.props.translate('workspace.reimburse.trackDistanceRate')}
                                placeholder={lodashGet(this.props, 'policy.outputCurrency', CONST.CURRENCY.USD)}
                                autoCompleteType="off"
                                autoCorrect={false}
                                keyboardType={CONST.KEYBOARD_TYPE.DECIMAL_PAD}
                                maxLength={12}
                                value={this.state.rate}
                                onChangeText={(value) => this.setState({rate: value})}
                            />
                            <View style={[styles.mt4]}>
                                <Picker
                                    value={this.state.unit}
                                    label={this.props.translate('workspace.reimburse.trackDistanceUnit')}
                                    items={this.getUnitItems()}
                                    onInputChange={(value) => this.setState({unit: value})}
                                />
                            </View>
                        </OfflineWithFeedback>
                    </Form>
                )}
            </WorkspacePageWithSections>
        );
    }
}

WorkspaceRateAndUnitPage.propTypes = propTypes;
WorkspaceRateAndUnitPage.defaultProps = defaultProps;

export default compose(
    withPolicy,
    withLocalize,
    withNetwork(),
    withOnyx({
        reimbursementAccount: {
            key: ONYXKEYS.REIMBURSEMENT_ACCOUNT,
        },
    }),
)(WorkspaceRateAndUnitPage);
