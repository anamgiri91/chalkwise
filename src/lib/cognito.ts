import { Platform } from 'react-native';
import { createSessionManager, type AuthSession } from './sessionManager';

class CognitoError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}
function config() {
  const region = process.env.EXPO_PUBLIC_AWS_REGION?.trim();
  const clientId = process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID?.trim();
  if (!region || !/^[a-z]{2}-[a-z]+-\d$/.test(region) || !clientId)
    throw new Error('Configure the AWS region and Cognito app client.');
  return { region, clientId };
}
async function cognito<T>(action: string, body: unknown): Promise<T> {
  const { region } = config();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`https://cognito-idp.${region}.amazonaws.com/`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': `AWSCognitoIdentityProviderService.${action}`,
      },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) {
      const code =
        String(result.__type ?? '')
          .split('#')
          .pop() ?? 'AuthError';
      const messages: Record<string, string> = {
        NotAuthorizedException: 'Your session or credentials are invalid. Please sign in again.',
        UserNotConfirmedException: 'Confirm your email before signing in.',
        UsernameExistsException: 'An account may already exist. Sign in or recover your password.',
        InvalidPasswordException:
          'Use at least 12 characters with uppercase, lowercase, a number and a symbol.',
        CodeMismatchException: 'That code does not match. Try again.',
        ExpiredCodeException: 'That code has expired. Request a new one.',
        LimitExceededException: 'Too many attempts. Please wait and try again.',
      };
      throw new CognitoError(
        code,
        messages[code] ?? 'The account request could not be completed. Try again.',
      );
    }
    return result as T;
  } finally {
    clearTimeout(timer);
  }
}
type TokenResult = {
  AuthenticationResult?: { AccessToken?: string; RefreshToken?: string; ExpiresIn?: number };
  ChallengeName?: string;
};
async function toSession(result: TokenResult, refreshToken?: string): Promise<AuthSession> {
  const tokens = result.AuthenticationResult;
  if (!tokens?.AccessToken || !(tokens.RefreshToken ?? refreshToken) || !tokens.ExpiresIn) {
    throw new Error(
      'This account requires an additional sign-in challenge. Contact the pilot administrator.',
    );
  }
  // GetUser validates the access token with Cognito; decoding a JWT is not authentication.
  const user = await cognito<{ UserAttributes: { Name: string; Value: string }[] }>('GetUser', {
    AccessToken: tokens.AccessToken,
  });
  const userId = user.UserAttributes.find((a) => a.Name === 'sub')?.Value;
  if (!userId) throw new Error('The account has no verified identity.');
  return {
    accessToken: tokens.AccessToken,
    refreshToken: tokens.RefreshToken ?? refreshToken!,
    userId,
    expiresAt: Date.now() + tokens.ExpiresIn * 1000,
  };
}
const refreshKey = 'chalkwise.cognito.refresh';
// Web deliberately keeps refresh tokens in memory. A page reload requires sign-in.
let webRefresh: string | null = null;
const sessions = createSessionManager({
  store: {
    async read() {
      if (Platform.OS === 'web') return webRefresh;
      return (await import('expo-secure-store')).getItemAsync(refreshKey);
    },
    async write(value) {
      if (Platform.OS === 'web') {
        webRefresh = value;
        return;
      }
      const secure = await import('expo-secure-store');
      if (value === null) await secure.deleteItemAsync(refreshKey);
      else
        await secure.setItemAsync(refreshKey, value, {
          keychainAccessible: secure.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        });
    },
  },
  async refresh(token) {
    const { clientId } = config();
    const result = await cognito<TokenResult>('InitiateAuth', {
      ClientId: clientId,
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      AuthParameters: { REFRESH_TOKEN: token },
    });
    return toSession(result, token);
  },
});
export async function getApiSession() {
  try {
    return await sessions.get();
  } catch (error) {
    if (error instanceof CognitoError && error.code === 'NotAuthorizedException') {
      await sessions.clear();
      return null;
    }
    throw error;
  }
}
export const onApiAuthChange = sessions.subscribe;
export async function apiSignUp(email: string, password: string) {
  if (password.length < 12) throw new Error('Use a password with at least 12 characters.');
  await cognito('SignUp', {
    ClientId: config().clientId,
    Username: email.trim().toLowerCase(),
    Password: password,
    UserAttributes: [{ Name: 'email', Value: email.trim().toLowerCase() }],
  });
  return { requiresEmailConfirmation: true };
}
export async function apiConfirmSignUp(email: string, code: string) {
  await cognito('ConfirmSignUp', {
    ClientId: config().clientId,
    Username: email.trim().toLowerCase(),
    ConfirmationCode: code.trim(),
  });
}
export async function apiResendCode(email: string) {
  await cognito('ResendConfirmationCode', {
    ClientId: config().clientId,
    Username: email.trim().toLowerCase(),
  });
}
export async function apiSignIn(email: string, password: string) {
  const result = await cognito<TokenResult>('InitiateAuth', {
    ClientId: config().clientId,
    AuthFlow: 'USER_PASSWORD_AUTH',
    AuthParameters: { USERNAME: email.trim().toLowerCase(), PASSWORD: password },
  });
  await sessions.set(await toSession(result));
}
export async function apiSignOut() {
  const session = await getApiSession().catch(() => null);
  await sessions.clear();
  if (session)
    await cognito('RevokeToken', {
      ClientId: config().clientId,
      Token: session.refreshToken,
    }).catch(() => {});
}
export async function apiForgotPassword(email: string) {
  await cognito('ForgotPassword', {
    ClientId: config().clientId,
    Username: email.trim().toLowerCase(),
  });
}
export async function apiResetPassword(email: string, code: string, password: string) {
  if (password.length < 12) throw new Error('Use a password with at least 12 characters.');
  await cognito('ConfirmForgotPassword', {
    ClientId: config().clientId,
    Username: email.trim().toLowerCase(),
    ConfirmationCode: code.trim(),
    Password: password,
  });
}
