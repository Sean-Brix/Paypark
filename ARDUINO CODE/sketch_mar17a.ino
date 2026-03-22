#define COIN_PIN 2

volatile int pulseCount = 0;
volatile unsigned long lastInterruptTime = 0;
volatile unsigned long lastPulseTime = 0;

const unsigned long debounceDelay = 40;
const unsigned long pulseTimeout = 600;

float getCoinValue(int pulses) {
  switch (pulses) {
    case 5: return 5.0;
    case 10: return 10.0;
    case 20: return 20.0;
    default: return 0.0;
  }
}

void coinISR() {
  unsigned long now = millis();

  if (now - lastInterruptTime > debounceDelay) {
    pulseCount++;
    lastInterruptTime = now;
    lastPulseTime = now;
  }
}

void setup() {
  Serial.begin(9600);
  pinMode(COIN_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(COIN_PIN), coinISR, FALLING);
  Serial.println("READY");
}

void loop() {
  int pulses = 0;
  unsigned long pulseTimeCopy = 0;

  noInterrupts();
  pulses = pulseCount;
  pulseTimeCopy = lastPulseTime;
  interrupts();

  if (pulses > 0 && (millis() - pulseTimeCopy > pulseTimeout)) {
    noInterrupts();
    pulses = pulseCount;
    pulseCount = 0;
    interrupts();

    float amount = getCoinValue(pulses);

    if (amount > 0) {
      Serial.println(amount, 2);
    } else {
      Serial.println("Unknown coin");
      Serial.print("Pulses: ");
      Serial.println(pulses);
    }
  }
}