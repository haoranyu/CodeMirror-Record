const cloneDeep = require('lodash/cloneDeep');

/**
 * isContinueSelect - Whether two select moves are treated continues
 *
 * @param  {object} firstChange  The first (previous) operation
 * @param  {object} secondChange The second (later) operation
 * @return {boolean}             Judege result whether moves are continues
 */
function isContinueSelect(firstChange, secondChange) {
  if (firstChange.crs.length !== secondChange.crs.length) {
    return false;
  } else {
    for (let i = 0; i < secondChange.crs.length; i++) {
      const firstCh = firstChange.crs[i];
      const secondCh = secondChange.crs[i];
      if (secondCh.anchor.line === secondCh.head.line &&
          secondCh.anchor.ch === secondCh.head.ch) {
        return false;
      } else if (
        firstCh.anchor.line !== secondCh.anchor.line ||
        firstCh.anchor.ch !== secondCh.anchor.ch) {
        return false;
      }
    }
  }
  return true;
}

/**
 * compressSelectionHeads - Compress heads position of selection operations
 *
 * @param  {type} heads Array of heads
 * @return {type}       Compressed result of heads
 */
function compressSelectionHeads(heads) {
  const resultArray = [];
  let currentLine = -1;
  while (heads.length > 0) {
    const head = heads.shift();
    if (currentLine !== head.line) {
      resultArray.push([head.line]);
      currentLine = head.line;
    }
    resultArray[resultArray.length - 1].push(head.ch);
  }
  for (let i = 0; i < resultArray.length; i++) {
    let chsInterval = resultArray[i].slice(1);
    chsInterval = convertChsToInterval(chsInterval);
    chsInterval = convertChsToInterval(chsInterval, -1);
    resultArray[i] = [resultArray[i][0], chsInterval];
  }
  return resultArray;
}

/**
 * convertChsToInterval - Convert character positions to interval description
 *
 * @param  {type} chs           Character positions
 * @param  {type} direction = 1 Positive is left to right. Negative is opposite
 * @return {type}               Interval description of character positions
 */
function convertChsToInterval(chs, direction = 1) {
  const resultArray = [];
  while (chs.length > 0) {
    const current = chs.shift();
    if (typeof(current) !== 'number') {
      resultArray.push(current);
    } else if (resultArray.length === 0 ||
               Array.isArray(resultArray[resultArray.length - 1])) {
      resultArray.push({from: current, to: current});
    } else if ('to' in resultArray[resultArray.length - 1]) {
      if (resultArray[resultArray.length - 1].to + direction !== current) {
        resultArray.push({from: current, to: current});
      } else {
        resultArray[resultArray.length - 1].to = current;
      }
    }
  }
  for (let i = 0; i < resultArray.length; i++) {
    if ('to' in resultArray[i]) {
      if (resultArray[i].from === resultArray[i].to) {
        resultArray[i] = resultArray[i].from;
      } else {
        resultArray[i] = [resultArray[i].from, resultArray[i].to];
      }
    }
  }
  return resultArray;
}

/**
 * compressContinuousSelect - Compress continues selection operations
 *
 * @param  {type} operations    The array of operations
 * @param  {type} direction = 1 Positive is left to right. Negative is opposite.
 * @return {type}               Comrpressed selection operations
 */
function compressContinuousSelect(operations, direction = 1) {
  const newOperations = [];
  while (operations.length > 0) {
    const operation = cloneDeep(operations.pop());
    if ('crs' in operation) {
      while (operations.length > 0) {
        const lastOperation = cloneDeep(operations.pop());
        if (('crs' in lastOperation) &&
        isContinueSelect(lastOperation, operation)) {
          operation.startTime = lastOperation.startTime;
          operation.delayDuration = lastOperation.delayDuration;
          operation.combo += 1;
          for (let i = 0; i < operation.crs.length; i++) {
            if (!('heads' in operation.crs[i])) {
              operation.crs[i].heads =
                [lastOperation.crs[i].head, operation.crs[i].head];
            } else {
              operation.crs[i].heads.unshift(lastOperation.crs[i].head);
            }
          }
        } else {
          operations.push(lastOperation);
          break;
        }
      }
      newOperations.unshift(operation);
    } else {
      newOperations.unshift(operation);
    }
  }
  return newOperations;
}

/**
 * convertSelectFormat - Convert selection to standard format
 *
 * @param  {type} operations The array of operations
 * @return {type}            Converted array of operations
 */
function convertSelectFormat(operations) {
  for (let i = 0; i < operations.length; i++) {
    if (('crs' in operations[i]) && operations[i].combo > 1) {
      operations[i].ops = [];
      for (let j = 0; j < operations[i].crs.length; j++) {
        operations[i].ops.push({
          from: operations[i].crs[j].anchor,
          to: operations[i].crs[j].anchor,
          origin: 'select',
          text: [''],
          removed: [''],
          select: compressSelectionHeads(operations[i].crs[j].heads),
        });
      }
      delete operations[i].crs;
    }
  }
  return operations;
}

/**
 * export default - Function for selection related compression
 *
 * @param  {type} operations Uncompressed operations of selections
 * @return {type}            Compressed operations
 */
export default function(operations) {
  operations = compressContinuousSelect(operations);
  operations = convertSelectFormat(operations);
  return operations;
}
