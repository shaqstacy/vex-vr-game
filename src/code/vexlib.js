// The `vex` Python module students import. Modelled on the VEXcode V5 Python API; every call is
// forwarded to the simulator through the native `_sim.call(op, ...)` bridge.
export const VEX_PY = String.raw`
import _sim

FORWARD = 1
REVERSE = -1
LEFT = -1
RIGHT = 1
UP = 1
DOWN = -1
MM = 'mm'
INCHES = 'in'
DEGREES = 'deg'
TURNS = 'rev'
PERCENT = 'pct'
RPM = 'rpm'
SECONDS = 'sec'
MSEC = 'msec'
BRAKE = 'brake'
COAST = 'coast'
HOLD = 'hold'
PRIMARY = 'primary'
PSI = 'psi'

class Color:
    RED = 'red'
    BLUE = 'blue'
    YELLOW = 'yellow'
    GRAY = 'gray'
    CLEAR = 'clear'
    NONE = 'none'

def _c(op, *a):
    return _sim.cmd(op, *a)

def wait(t, units=SECONDS):
    _c('wait', t / 1000.0 if units == MSEC else t)

def _m(v, units):
    if units == INCHES:
        return v * 0.0254
    return v / 1000.0

def _deg(v, units):
    if units == TURNS:
        return v * 360.0
    return v

class Drivetrain:
    def drive(self, direction=FORWARD, velocity=None, units=PERCENT):
        if velocity is not None:
            self.set_drive_velocity(velocity, units)
        _c('drive', direction)
    def drive_for(self, direction, distance, units=MM, velocity=None, units_v=PERCENT, wait=True):
        if velocity is not None:
            self.set_drive_velocity(velocity, units_v)
        _c('drive_for', direction * _m(distance, units), wait)
    def strafe(self, direction=RIGHT):
        _c('strafe', direction)
    def strafe_for(self, direction, distance, units=MM, wait=True):
        _c('strafe_for', direction * _m(distance, units), wait)
    def turn(self, direction=RIGHT, velocity=None, units=PERCENT):
        if velocity is not None:
            self.set_turn_velocity(velocity, units)
        _c('turn', direction)
    def turn_for(self, direction, angle, units=DEGREES, velocity=None, units_v=PERCENT, wait=True):
        if velocity is not None:
            self.set_turn_velocity(velocity, units_v)
        _c('turn_for', direction * _deg(angle, units), wait)
    def turn_to_heading(self, angle, units=DEGREES, wait=True):
        _c('turn_to', angle, wait)
    def turn_to_rotation(self, angle, units=DEGREES, wait=True):
        _c('turn_to', angle, wait)
    def stop(self, mode=None):
        _c('stop')
    def set_drive_velocity(self, v, units=PERCENT):
        _c('set_drive_vel', v, units)
    def set_turn_velocity(self, v, units=PERCENT):
        _c('set_turn_vel', v, units)
    def set_stopping(self, mode=BRAKE):
        pass
    def set_timeout(self, t, units=SECONDS):
        pass
    def heading(self, units=DEGREES):
        return _c('heading')
    def rotation(self, units=DEGREES):
        return _c('rotation')
    def set_heading(self, v, units=DEGREES):
        _c('set_heading', v)
    def set_rotation(self, v, units=DEGREES):
        _c('set_heading', v)
    def is_done(self):
        return _c('drive_done')
    def is_moving(self):
        return not _c('drive_done')
    def velocity(self, units=PERCENT):
        return _c('drive_velocity', units)
    def arcade(self, forward, turn, strafe=0):
        _c('arcade', forward, turn, strafe)
    def tank(self, left, right):
        _c('tank', left, right)

class Motor:
    def __init__(self, name):
        self._n = name
    def spin(self, direction=FORWARD, velocity=None, units=PERCENT):
        if velocity is not None:
            self.set_velocity(velocity, units)
        _c('motor_spin', self._n, direction)
    def spin_for(self, direction, amount, units=DEGREES, velocity=None, units_v=PERCENT, wait=True):
        if velocity is not None:
            self.set_velocity(velocity, units_v)
        _c('motor_for', self._n, direction * _deg(amount, units), wait)
    def spin_to_position(self, position, units=DEGREES, velocity=None, units_v=PERCENT, wait=True):
        if velocity is not None:
            self.set_velocity(velocity, units_v)
        _c('motor_to', self._n, _deg(position, units), wait)
    def stop(self, mode=None):
        _c('motor_spin', self._n, 0)
    def set_velocity(self, v, units=PERCENT):
        _c('motor_vel', self._n, v, units)
    def set_position(self, v, units=DEGREES):
        _c('motor_setpos', self._n, _deg(v, units))
    def position(self, units=DEGREES):
        p = _c('motor_pos', self._n)
        return p / 360.0 if units == TURNS else p
    def velocity(self, units=PERCENT):
        return _c('motor_rate', self._n, units)
    def is_done(self):
        return _c('motor_done', self._n)
    def is_spinning(self):
        return not _c('motor_done', self._n)
    def set_stopping(self, mode=BRAKE):
        pass
    def set_max_torque(self, v, units=PERCENT):
        pass
    def set_timeout(self, t, units=SECONDS):
        pass

class Lift(Motor):
    def to_height(self, mm, wait=True):
        _c('lift_to', mm / 1000.0, wait)
    def height(self, units=MM):
        return _c('lift_height')

class Pneumatics:
    def __init__(self, name):
        self._n = name
    def set(self, value):
        return _c('piston', self._n, bool(value))
    def open(self):
        return _c('piston', self._n, True)
    def close(self):
        return _c('piston', self._n, False)
    def value(self):
        return _c('piston_val', self._n)

DigitalOut = Pneumatics

class Claw:
    # works for both the motor claw and the pneumatic claw
    def close(self):
        _c('claw', True)
    def open(self):
        _c('claw', False)
    def is_holding(self):
        return _c('holding')

class _Screen:
    def print(self, *args, **kw):
        _c('print', ' '.join([str(a) for a in args]))
    def new_line(self):
        _c('newline')
    def next_row(self):
        _c('newline')
    def clear_screen(self):
        _c('clear')
    def clear_row(self, row=None):
        _c('clear_row', row)
    def set_cursor(self, row, col):
        _c('cursor', row, col)
    def set_font(self, *a):
        pass
    def set_pen_color(self, *a):
        pass

class _Timer:
    def time(self, units=MSEC):
        t = _c('timer')
        return t if units == SECONDS else t * 1000.0
    def clear(self):
        _c('timer_clear')
    def reset(self):
        _c('timer_clear')

class _Battery:
    def capacity(self, units=PERCENT):
        return 100

class Brain:
    def __init__(self):
        self.screen = _Screen()
        self.timer = _Timer()
        self.battery = _Battery()

class _Axis:
    def __init__(self, n):
        self._n = n
    def position(self, units=PERCENT):
        return _c('axis', self._n)

class _Button:
    def __init__(self, n):
        self._n = n
    def pressing(self):
        return _c('button', self._n)

class Controller:
    def __init__(self, kind=PRIMARY):
        self.axis1 = _Axis(1)
        self.axis2 = _Axis(2)
        self.axis3 = _Axis(3)
        self.axis4 = _Axis(4)
        self.buttonL1 = _Button('L1')
        self.buttonL2 = _Button('L2')
        self.buttonR1 = _Button('R1')
        self.buttonR2 = _Button('R2')
        self.buttonA = _Button('A')
        self.buttonB = _Button('B')
        self.buttonX = _Button('X')
        self.buttonY = _Button('Y')
        self.buttonUp = _Button('Up')
        self.buttonDown = _Button('Down')
        self.buttonLeft = _Button('Left')
        self.buttonRight = _Button('Right')
        self.screen = _Screen()
    def rumble(self, pattern='.'):
        pass

class Inertial:
    def heading(self, units=DEGREES):
        return _c('sensor', 'inertial', 'heading')
    def rotation(self, units=DEGREES):
        return _c('sensor', 'inertial', 'rotation')
    def set_heading(self, v, units=DEGREES):
        _c('set_heading', v)
    def set_rotation(self, v, units=DEGREES):
        _c('set_heading', v)
    def calibrate(self):
        _c('wait', 0.5)
    def is_calibrating(self):
        return False

class Distance:
    def object_distance(self, units=MM):
        d = _c('sensor', 'distance', 'mm')
        return d / 25.4 if units == INCHES else d
    def is_object_detected(self):
        return _c('sensor', 'distance', 'mm') < 2000

class Optical:
    def color(self):
        return _c('sensor', 'optical', 'color')
    def hue(self):
        return _c('sensor', 'optical', 'hue')
    def is_near_object(self):
        return _c('sensor', 'optical', 'near')
    def set_light(self, *a):
        pass
    def set_light_power(self, *a):
        pass

class Bumper:
    def pressing(self):
        return _c('sensor', 'bumper', 'pressing')

class Gps:
    def x_position(self, units=MM):
        v = _c('sensor', 'gps', 'x')
        return v / 25.4 if units == INCHES else v
    def y_position(self, units=MM):
        v = _c('sensor', 'gps', 'y')
        return v / 25.4 if units == INCHES else v
    def heading(self, units=DEGREES):
        return _c('sensor', 'gps', 'heading')

class AirTank:
    def pressure(self, units=PSI):
        return _c('psi')

class Competition:
    def __init__(self, driver, autonomous):
        global _comp
        _comp = (driver, autonomous)

_comp = None

def vex_run_competition():
    if _comp is None:
        return
    mode = _c('mode')
    if mode in ('auton', 'match'):
        try:
            _comp[1]()
        except SystemExit:
            pass
        _c('phase_done', 'auton')
    if mode in ('driver', 'match'):
        try:
            _comp[0]()
        except SystemExit:
            pass

# ---- Robot configuration (generated from the Build tab) ----
brain = Brain()
controller = Controller(PRIMARY)
controller_1 = controller
drivetrain = Drivetrain()
lift_motor = Lift('lift')
lift = lift_motor
claw_motor = Motor('claw')
claw = Claw()
claw_piston = Pneumatics('claw')
flipper = Pneumatics('flipper')
air_tank = AirTank()
inertial = Inertial()
inertial_sensor = inertial
distance = Distance()
distance_sensor = distance
optical = Optical()
optical_sensor = optical
bumper = Bumper()
gps = Gps()
`;
