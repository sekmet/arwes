import React from 'react';
import PropTypes from 'prop-types';
import { useAnimation } from '../useAnimation';
import { EnergyContext } from '../EnergyContext';
import { useEnergy } from '../useEnergy';

const ENTERING = 'entering';
const ENTERED = 'entered';
const EXITING = 'exiting';
const EXITED = 'exited';

class Component extends React.PureComponent {
  static propTypes = {
    animate: PropTypes.bool,
    root: PropTypes.bool,
    activate: PropTypes.bool,
    duration: PropTypes.oneOfType([
      PropTypes.number,
      PropTypes.shape({
        enter: PropTypes.number,
        exit: PropTypes.number,
        delay: PropTypes.number
      })
    ]),
    merge: PropTypes.bool,
    onActivate: PropTypes.func,
    animationContext: PropTypes.any,
    parentEnergyContext: PropTypes.any,
    children: PropTypes.any
  };

  constructor () {
    super(...arguments);

    this.state = this.getInitialState();
    this.flowHasEntered = false;
    this.flowHasExited = false;
    this.activated = false;
    this.customDuration = null;
    this.scheduleTimeout = null;
  }

  getInitialState () {
    // The initial state is defined with some initial props. Though it is considered
    // an anti-pattern, energy flow needs to have a behavior from the beginning
    // according to props and it needs to be updated depending on future changes
    // selectively.

    const flowValue = this.isAnimate() ? EXITED : ENTERED;
    const energyInterface = this.getEnergyInterface(flowValue);
    return { flowValue, energyInterface };
  }

  componentDidMount () {
    const animate = this.isAnimate();
    const activated = this.isActivated();

    if (animate && activated) {
      this.enter();
    }
  }

  componentDidUpdate () {
    const animate = this.isAnimate();
    const activated = this.isActivated();

    if (animate && activated !== this.activated) {
      this.activated = activated;

      if (this.props.onActivate) {
        this.props.onActivate(activated);
      }

      if (activated) {
        this.enter();
      }
      else {
        this.exit();
      }
    }
  }

  componentWillUnmount () {
    this.unschedule();
  }

  render () {
    return (
      <EnergyContext.Provider value={this.state.energyInterface}>
        {this.props.children}
      </EnergyContext.Provider>
    );
  }

  setFlowValue (flowValue) {
    const energyInterface = this.getEnergyInterface(flowValue);
    this.setState(
      state => ({ ...state, flowValue, energyInterface }),
      () => {
        if (flowValue === ENTERED) {
          this.flowHasEntered = true;
        }
        else if (flowValue === EXITED) {
          this.flowHasExited = true;
        }
      }
    );
  }

  getFlow () {
    return this.state.energyInterface.flow;
  }

  getEnergyInterface (flowValue) {
    const { getDuration, getDurationIn, getDurationOut, hasEntered, hasExited } = this;
    const flow = Object.freeze({ value: flowValue, [flowValue]: true });

    return Object.freeze({
      getDuration,
      getDurationIn,
      getDurationOut,
      hasEntered,
      hasExited,
      flow
    });
  }

  isAnimate () {
    let animate = true;

    const providedAnimate = this.props.animationContext.animate;
    if (providedAnimate !== void 0) {
      animate = providedAnimate;
    }

    const propAnimate = this.props.animate;
    if (propAnimate !== void 0) {
      animate = propAnimate;
    }

    return animate;
  }

  isRoot () {
    let root = true;

    if (this.props.parentEnergyContext) {
      root = false;
    }

    if (this.props.root !== void 0) {
      root = this.props.root;
    }

    return root;
  }

  getDuration = () => {
    const defaultDuration = { enter: 200, exit: 200, delay: 0 };

    const providedDuration = this.props.animationContext.duration;

    const propValue = this.props.duration;
    const propDuration = typeof propValue === 'number'
      ? { enter: propValue, exit: propValue }
      : propValue;

    const duration = {
      ...defaultDuration,
      ...providedDuration,
      ...propDuration,
      ...this.customDuration
    };

    return duration;
  }

  getDurationIn = () => {
    const duration = this.getDuration();
    return duration.enter + duration.delay;
  }

  getDurationOut = () => {
    const duration = this.getDuration();
    return duration.exit;
  }

  updateDuration = duration => {
    const customDuration = typeof duration === 'number'
      ? { enter: duration, exit: duration }
      : duration;
    this.customDuration = customDuration;
  }

  hasEntered = () => {
    return this.flowHasEntered;
  }

  hasExited = () => {
    return this.flowHasExited;
  }

  isActivated () {
    if (this.isRoot()) {
      if (this.props.activate !== void 0) {
        return this.props.activate;
      }
      return true;
    }
    else {
      const parentFlow = this.props.parentEnergyContext.flow;

      if (this.props.merge) {
        return !!(parentFlow.entering || parentFlow.entered);
      }
      else {
        return !!parentFlow.entered;
      }
    }
  }

  enter () {
    const flowValue = this.state.flowValue;

    if (flowValue === ENTERING || flowValue === ENTERED) {
      return;
    }

    const duration = this.getDuration();
    const delay = flowValue === EXITED ? duration.delay : 0;

    this.schedule(delay, () => {
      const duration = this.getDuration();

      this.setFlowValue(ENTERING);
      this.schedule(duration.enter, () => this.setFlowValue(ENTERED));
    });
  }

  exit () {
    const flowValue = this.state.flowValue;

    if (flowValue === EXITING || flowValue === EXITED) {
      return;
    }

    this.schedule(0, () => {
      const duration = this.getDuration();

      this.setFlowValue(EXITING);
      this.schedule(duration.exit, () => this.setFlowValue(EXITED));
    });
  }

  unschedule () {
    clearTimeout(this.scheduleTimeout);
  }

  schedule (time, callback) {
    this.unschedule();
    this.scheduleTimeout = setTimeout(callback, time);
  }
}

const Energy = React.forwardRef((props, ref) => {
  const animationContext = useAnimation();
  const parentEnergyContext = useEnergy();

  return (
    <Component
      {...props}
      ref={ref}
      animationContext={animationContext}
      parentEnergyContext={parentEnergyContext}
    />
  );
});

Energy.displayName = 'Energy';

export { Component, Energy };
