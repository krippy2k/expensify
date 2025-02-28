import requireParameters from './requireParameters';
import * as Network from './Network';
import * as NetworkStore from './Network/NetworkStore';
import updateSessionAuthTokens from './actions/Session/updateSessionAuthTokens';
import CONFIG from '../CONFIG';
import redirectToSignIn from './actions/SignInRedirect';
import CONST from '../CONST';
import Log from './Log';
import * as ErrorUtils from './ErrorUtils';
import Response from '../types/onyx/Response';

type Parameters = {
    useExpensifyLogin?: boolean;
    partnerName: string;
    partnerPassword: string;
    partnerUserID?: string;
    partnerUserSecret?: string;
    twoFactorAuthCode?: string;
    email?: string;
    authToken?: string;
};

function Authenticate(parameters: Parameters): Promise<Response> {
    const commandName = 'Authenticate';

    requireParameters(['partnerName', 'partnerPassword', 'partnerUserID', 'partnerUserSecret'], parameters, commandName);

    return Network.post(commandName, {
        // When authenticating for the first time, we pass useExpensifyLogin as true so we check
        // for credentials for the expensify partnerID to let users Authenticate with their expensify user
        // and password.
        useExpensifyLogin: parameters.useExpensifyLogin,
        partnerName: parameters.partnerName,
        partnerPassword: parameters.partnerPassword,
        partnerUserID: parameters.partnerUserID,
        partnerUserSecret: parameters.partnerUserSecret,
        twoFactorAuthCode: parameters.twoFactorAuthCode,
        authToken: parameters.authToken,
        shouldRetry: false,

        // Force this request to be made because the network queue is paused when re-authentication is happening
        forceNetworkRequest: true,

        // Add email param so the first Authenticate request is logged on the server w/ this email
        email: parameters.email,
    });
}

/**
 * Reauthenticate using the stored credentials and redirect to the sign in page if unable to do so.
 * @param [command] command name for logging purposes
 */
function reauthenticate(command = ''): Promise<void> {
    // Prevent any more requests from being processed while authentication happens
    NetworkStore.setIsAuthenticating(true);

    const credentials = NetworkStore.getCredentials();
    return Authenticate({
        useExpensifyLogin: false,
        partnerName: CONFIG.EXPENSIFY.PARTNER_NAME,
        partnerPassword: CONFIG.EXPENSIFY.PARTNER_PASSWORD,
        partnerUserID: credentials?.autoGeneratedLogin,
        partnerUserSecret: credentials?.autoGeneratedPassword,
    }).then((response) => {
        if (response.jsonCode === CONST.JSON_CODE.UNABLE_TO_RETRY) {
            // If authentication fails, then the network can be unpaused
            NetworkStore.setIsAuthenticating(false);

            // When a fetch() fails due to a network issue and an error is thrown we won't log the user out. Most likely they
            // have a spotty connection and will need to try to reauthenticate when they come back online. We will error so it
            // can be handled by callers of reauthenticate().
            throw new Error('Unable to retry Authenticate request');
        }

        // If authentication fails and we are online then log the user out
        if (response.jsonCode !== 200) {
            const errorMessage = ErrorUtils.getAuthenticateErrorMessage(response);
            NetworkStore.setIsAuthenticating(false);
            Log.hmmm('Redirecting to Sign In because we failed to reauthenticate', {
                command,
                error: errorMessage,
            });
            redirectToSignIn(errorMessage);
            return;
        }

        // Update authToken in Onyx and in our local variables so that API requests will use the new authToken
        updateSessionAuthTokens(response.authToken, response.encryptedAuthToken);

        // Note: It is important to manually set the authToken that is in the store here since any requests that are hooked into
        // reauthenticate .then() will immediate post and use the local authToken. Onyx updates subscribers lately so it is not
        // enough to do the updateSessionAuthTokens() call above.
        NetworkStore.setAuthToken(response.authToken ?? null);

        // The authentication process is finished so the network can be unpaused to continue processing requests
        NetworkStore.setIsAuthenticating(false);
    });
}

export {reauthenticate, Authenticate};
