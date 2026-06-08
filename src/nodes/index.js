import StartNode from './StartNode.jsx';
import MatchScreenNode from './MatchScreenNode.jsx';
import FindElementNode from './FindElementNode.jsx';
import WaitForImageNode from './WaitForImageNode.jsx';
import TapNode from './TapNode.jsx';
import SwipeNode from './SwipeNode.jsx';
import WaitNode from './WaitNode.jsx';
import LoopNode from './LoopNode.jsx';
import LogNode from './LogNode.jsx';
import TypeTextNode from './TypeTextNode.jsx';
import FindTapNode from './FindTapNode.jsx';
import RandomTapNode from './RandomTapNode.jsx';

export const nodeTypes = {
  start: StartNode,
  match_screen: MatchScreenNode,
  find_element: FindElementNode,
  wait_for_image: WaitForImageNode,
  tap: TapNode,
  swipe: SwipeNode,
  wait: WaitNode,
  loop: LoopNode,
  log: LogNode,
  type_text: TypeTextNode,
  find_tap: FindTapNode,
  random_tap: RandomTapNode,
};

export const NODE_DEFAULTS = {
  start: { label: 'Start' },
  match_screen: { label: 'Match Screen', threshold: 0.8 },
  find_element: { label: 'Find Element', threshold: 0.8 },
  wait_for_image: { label: 'Wait for Image', threshold: 0.8, timeout: 30 },
  tap: { label: 'Tap', x: 0, y: 0, duration: 100 },
  swipe: { label: 'Swipe', x1: 0, y1: 0, x2: 100, y2: 100, duration: 300 },
  wait: { label: 'Wait', seconds: 1 },
  loop: { label: 'Loop', iterations: 3 },
  log: { label: 'Log', message: '' },
  type_text: { label: 'Type Text', text: '' },
  find_tap: { label: 'Find & Tap', threshold: 0.7, duration: 100 },
  random_tap: { label: 'Random Tap', x1: 200, y1: 250, x2: 1400, y2: 850, duration: 100 },
};
