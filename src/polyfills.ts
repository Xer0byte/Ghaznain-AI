import { Buffer } from 'buffer';
import * as util from 'util';
import process from 'process';
import EventEmitter from 'events';
import Stream from 'stream-browserify';

if (typeof window !== 'undefined') {
  (window as any).global = window;
  (window as any).Buffer = Buffer;
  (window as any).process = process;
  (window as any).util = util;
  (window as any).EventEmitter = EventEmitter;
  (window as any).Stream = Stream;
}
