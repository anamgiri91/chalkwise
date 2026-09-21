import { useState } from 'react';
import { router } from 'expo-router';
import { TextInput, View } from 'react-native';
import { Screen } from '@/components/ui/Screen';
import { AppButton } from '@/components/ui/AppButton';
import { PasswordField } from '@/components/ui/PasswordField';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { confirmEmail, resendConfirmationCode, requestPasswordReset, resetPassword } from '@/services/auth';

export default function AccountHelp() {
  const theme=useTheme();
  const [email,setEmail]=useState('');
  const [code,setCode]=useState('');
  const [password,setPassword]=useState('');
  const [mode,setMode]=useState<'confirm'|'reset'>('reset');
  const [sent,setSent]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const style={ padding:16,minHeight:52,borderRadius:12,color:theme.text,backgroundColor:theme.backgroundElement };
  async function submit() {
    if(busy) return;
    setBusy(true);setError('');
    try {
      if(!sent) {
        if(mode==='confirm') await resendConfirmationCode(email); else await requestPasswordReset(email);
        setSent(true);
      } else {
        if(mode==='confirm') await confirmEmail(email,code); else await resetPassword(email,code,password);
        router.replace('/login');
      }
    } catch(e) { setError(e instanceof Error?e.message:'Please try again.'); }
    finally { setBusy(false); }
  }
  return <Screen avoidKeyboard>
    <ThemedText type="title">Get back to learning.</ThemedText>
    <ThemedText themeColor="textSecondary">Confirm your email or reset your password using an emailed code.</ThemedText>
    {!sent ? <View style={{gap:12}}>
      <AppButton secondary={mode!=='reset'} title="Reset password" disabled={busy} onPress={()=>setMode('reset')} />
      <AppButton secondary={mode!=='confirm'} title="Confirm email" disabled={busy} onPress={()=>setMode('confirm')} />
    </View>:null}
    <TextInput style={style} value={email} onChangeText={setEmail} editable={!busy&&!sent} autoCapitalize="none" keyboardType="email-address" autoComplete="email" accessibilityLabel="Email" placeholder="University email" placeholderTextColor={theme.textSecondary} />
    {sent ? <>
      <ThemedText accessibilityLiveRegion="polite">Check your email for a verification code.</ThemedText>
      <TextInput style={style} value={code} onChangeText={setCode} editable={!busy} textContentType="oneTimeCode" keyboardType="number-pad" accessibilityLabel="Verification code" placeholder="Verification code" placeholderTextColor={theme.textSecondary} />
      {mode==='reset'?<PasswordField style={style} value={password} onChangeText={setPassword} editable={!busy} textContentType="newPassword" accessibilityLabel="New password" placeholder="At least 12 characters" placeholderTextColor={theme.textSecondary} />:null}
    </>:null}
    {error?<ThemedText accessibilityRole="alert">{error}</ThemedText>:null}
    <AppButton title={busy?'Please wait…':sent?'Verify and continue':'Send code'} disabled={busy||!email.trim()||(sent&&(!code.trim()||(mode==='reset'&&password.length<12)))} onPress={submit} />
    {sent?<AppButton secondary title="Change email or send another code" disabled={busy} onPress={()=>setSent(false)} />:null}
    <AppButton secondary title="Back to sign in" onPress={()=>router.replace('/login')} />
  </Screen>;
}
