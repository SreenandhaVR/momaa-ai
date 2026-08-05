import { useMutation } from '@tanstack/react-query';
import { Link, router } from 'expo-router';
import { Eye } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { Button } from '@momaa/ui';
import { ApiRequestError } from '../../lib/api';
import { useAuthStore } from '../../lib/auth-store';

const eyeClosedIcon = require('../../assets/icons/eye-closed-icon.png');
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Field = 'email' | 'password';
type FieldErrors = Partial<Record<Field, string>>;

function validateEmail(value: string): string | undefined {
  const trimmedValue = value.trim();
  if (!trimmedValue) return 'Email is required.';
  if (!emailPattern.test(trimmedValue)) return 'Please enter a valid email address.';
  return undefined;
}

function validatePassword(value: string): string | undefined {
  const trimmedValue = value.trim();
  if (!trimmedValue) return 'Password is required.';
  if (trimmedValue.length < 8) return 'Password must contain at least 8 characters.';
  return undefined;
}

function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 401) return 'Invalid email or password.';
    if (error.status === 403) return 'Your account has been disabled.';
    if (error.status === 404) return 'Account not found.';
    if (error.status >= 500) return 'Something went wrong. Please try again.';
  }
  if (error instanceof TypeError) return 'Unable to connect. Check your internet connection.';
  return 'Something went wrong. Please try again.';
}

function ValidationMessage({ message, id }: { message?: string; id: string }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-3)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: message ? 1 : 0, duration: 160, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: message ? 0 : -3, duration: 160, useNativeDriver: true })
    ]).start();
  }, [message, opacity, translateY]);

  return (
    <View style={styles.validationSpace}>
      <Animated.Text
        nativeID={id}
        accessibilityLiveRegion="polite"
        style={[styles.validationMessage, { opacity, transform: [{ translateY }] }]}
      >
        {message ?? ' '}
      </Animated.Text>
    </View>
  );
}

export default function LoginScreen() {
  const login = useAuthStore((state) => state.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const emailInput = useRef<TextInput>(null);
  const passwordInput = useRef<TextInput>(null);
  const passwordToggleOpacity = useRef(new Animated.Value(1)).current;

  const updateError = (field: Field, error?: string) => {
    setErrors((currentErrors) =>
      currentErrors[field] === error ? currentErrors : { ...currentErrors, [field]: error }
    );
  };

  const validateField = (field: Field, value: string) => {
    const error = field === 'email' ? validateEmail(value) : validatePassword(value);
    updateError(field, error);
    return error;
  };

  const validateForm = () => {
    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);
    setErrors({ email: emailError, password: passwordError });
    if (emailError) {
      emailInput.current?.focus();
      return false;
    }
    if (passwordError) {
      passwordInput.current?.focus();
      return false;
    }
    return true;
  };

  const mutation = useMutation({
    mutationFn: () => login({ email: email.trim(), password: password.trim() }),
    onSuccess: () => {
      setErrors({});
      setFormError(undefined);
      router.replace('/(tabs)' as never);
    },
    onError: (error) => {
      console.error('[auth] Login failed:', error);
      setFormError(loginErrorMessage(error));
    }
  });

  const submit = () => {
    if (mutation.isPending) return;
    setFormError(undefined);
    if (!validateForm()) return;
    mutation.mutate();
  };

  const togglePasswordVisibility = () => {
    Animated.timing(passwordToggleOpacity, { toValue: 0, duration: 80, useNativeDriver: true }).start(
      () => {
        setShowPassword((visible) => !visible);
        Animated.timing(passwordToggleOpacity, { toValue: 1, duration: 120, useNativeDriver: true }).start();
      }
    );
  };

  const disabled = mutation.isPending;

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: 'padding', android: undefined })}
      className="flex-1 bg-background"
    >
      <View className="flex-1 justify-center px-6">
        <Text className="font-jakarta-bold text-3xl tracking-tight text-text-primary">
          Welcome to Momaa
        </Text>
        <Text className="mt-3 font-jakarta text-base leading-6 text-text-secondary">
          Your calm companion for the everyday moments.
        </Text>
        <View className="mt-10 gap-4">
          <View>
            <TextInput
              ref={emailInput}
              className="rounded-input border border-border bg-card px-5 py-4 font-jakarta text-text-primary"
              style={errors.email ? styles.invalidInput : undefined}
              accessibilityLabel="Email"
              aria-describedby="login-email-error"
              aria-invalid={Boolean(errors.email)}
              autoCapitalize="none"
              autoComplete="email"
              autoFocus
              editable={!disabled}
              keyboardType="email-address"
              placeholder="Email"
              placeholderTextColor="#9CA3AF"
              value={email}
              onBlur={() => validateField('email', email)}
              onChangeText={(value) => {
                setEmail(value);
                if (errors.email) validateField('email', value);
              }}
              onSubmitEditing={() => passwordInput.current?.focus()}
              returnKeyType="next"
            />
            <ValidationMessage id="login-email-error" message={errors.email} />
          </View>
          <View>
            <View>
              <TextInput
                ref={passwordInput}
                className="rounded-input border border-border bg-card px-5 py-4 pr-14 font-jakarta text-text-primary"
                style={errors.password ? styles.invalidInput : undefined}
                accessibilityLabel="Password"
                aria-describedby="login-password-error"
                aria-invalid={Boolean(errors.password)}
                autoComplete="current-password"
                editable={!disabled}
                placeholder="Password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPassword}
                value={password}
                onBlur={() => validateField('password', password)}
                onChangeText={(value) => {
                  setPassword(value);
                  if (errors.password) validateField('password', value);
                }}
                onSubmitEditing={submit}
                returnKeyType="go"
              />
              <Pressable
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                accessibilityRole="button"
                disabled={disabled}
                hitSlop={10}
                onPress={togglePasswordVisibility}
                style={styles.passwordToggle}
              >
                <Animated.View style={{ opacity: passwordToggleOpacity }}>
                  {showPassword ? (
                    <Eye color="#6B7280" size={20} strokeWidth={1.8} />
                  ) : (
                    <Image source={eyeClosedIcon} style={styles.closedEye} resizeMode="contain" />
                  )}
                </Animated.View>
              </Pressable>
            </View>
            <ValidationMessage id="login-password-error" message={errors.password} />
          </View>
          {formError ? <Text accessibilityLiveRegion="polite" style={styles.formError}>{formError}</Text> : null}
          <Button onPress={submit} disabled={disabled} loading={disabled}>
            {disabled ? 'Signing in...' : 'Sign in'}
          </Button>
        </View>
        <Link
          href={'/(auth)/register' as never}
          className="mt-7 text-center font-jakarta text-text-secondary"
        >
          New here? <Text className="font-jakarta-bold text-text-primary">Create an account</Text>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  invalidInput: {
    borderColor: '#D6B86A',
    shadowColor: '#D6B86A',
    shadowOpacity: 0.16,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1
  },
  validationSpace: { minHeight: 18, paddingTop: 4 },
  validationMessage: {
    color: '#6B7280',
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16
  },
  passwordToggle: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: 17,
    top: 0,
    bottom: 0
  },
  closedEye: { width: 21, height: 21 },
  formError: {
    color: '#6B7280',
    fontFamily: 'PlusJakartaSans_400Regular',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
    marginTop: -4
  }
});
