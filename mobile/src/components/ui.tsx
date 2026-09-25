import { ActivityIndicator, Pressable, TextInput, type TextInputProps, View } from "react-native";
import { T } from "@/components/T";
import { HAIR, RADIUS, TYPE, useColors } from "@/lib/theme";

/** 꽉 찬 버튼(검정 바탕 흰 글씨)과 선 버튼. 웹의 두 버튼과 같다. */
export function Button({
  label,
  onPress,
  kind = "solid",
  disabled,
  busy,
  big,
}: {
  label: string;
  onPress: () => void;
  kind?: "solid" | "line";
  disabled?: boolean;
  busy?: boolean;
  big?: boolean;
}) {
  const c = useColors();
  const solid = kind === "solid";
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => ({
        height: big ? 48 : 34,
        paddingHorizontal: 16,
        borderRadius: big ? RADIUS.card : 17,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: solid ? c.ink : "transparent",
        borderWidth: solid ? 0 : HAIR,
        borderColor: c.hairline,
        opacity: disabled ? 0.3 : pressed ? 0.7 : 1,
      })}
    >
      {busy ? <ActivityIndicator color={solid ? c.bg : c.ink} /> : <T w="600" color={solid ? c.bg : c.ink}>{label}</T>}
    </Pressable>
  );
}

export function Field(props: TextInputProps) {
  const c = useColors();
  return (
    <TextInput
      placeholderTextColor={c.ink3}
      {...props}
      style={[
        TYPE.body,
        { height: 48, borderRadius: RADIUS.card, backgroundColor: c.grouped, paddingHorizontal: 16, color: c.ink },
        props.style,
      ]}
    />
  );
}

export function Empty({ title, note, children }: { title?: string; note?: string; children?: React.ReactNode }) {
  return (
    <View style={{ alignItems: "center", gap: 12, paddingHorizontal: 32, paddingVertical: 64 }}>
      {title ? (
        <T v="lead" w="700">
          {title}
        </T>
      ) : null}
      {note ? (
        <T c="ink3" style={{ textAlign: "center" }}>
          {note}
        </T>
      ) : null}
      {children}
    </View>
  );
}
