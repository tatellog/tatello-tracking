import { Pressable, Text } from 'react-native'

type Props = {
  completed: boolean
  onPress: () => void
}

export function WorkoutCheckIn({ completed, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      className={
        completed
          ? 'w-full items-center rounded-md bg-success px-4 py-4'
          : 'w-full items-center rounded-md border border-default bg-secondary px-4 py-4'
      }
    >
      <Text
        className={
          completed
            ? 'text-base font-medium text-success'
            : 'text-base font-medium text-primary'
        }
      >
        {completed ? '✓ Entrenado hoy' : '¿Entrenaste hoy?'}
      </Text>
    </Pressable>
  )
}
