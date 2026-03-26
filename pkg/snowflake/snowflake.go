package snowflake

import (
	"strconv"
	"sync"
	"time"
)

// Valhalla Epoch: 2026-01-01T00:00:00.000Z
const Epoch int64 = 1735689600000

const (
	workerIDBits     = 5
	processIDBits    = 5
	sequenceBits     = 12
	maxWorkerID      = -1 ^ (-1 << workerIDBits)
	maxProcessID     = -1 ^ (-1 << processIDBits)
	maxSequence      = -1 ^ (-1 << sequenceBits)
	workerIDShift    = sequenceBits
	processIDShift   = sequenceBits + workerIDBits
	timestampShift   = sequenceBits + workerIDBits + processIDBits
)

// ID is a Valhalla Snowflake ID (64-bit).
type ID int64

// Generator produces unique Snowflake IDs.
type Generator struct {
	mu        sync.Mutex
	lastTime  int64
	workerID  int64
	processID int64
	sequence  int64
}

// NewGenerator creates a new Snowflake ID generator.
func NewGenerator(workerID, processID int64) *Generator {
	if workerID < 0 || workerID > maxWorkerID {
		panic("snowflake: workerID out of range")
	}
	if processID < 0 || processID > maxProcessID {
		panic("snowflake: processID out of range")
	}
	return &Generator{
		workerID:  workerID,
		processID: processID,
	}
}

// Generate produces a new unique Snowflake ID.
func (g *Generator) Generate() ID {
	g.mu.Lock()
	defer g.mu.Unlock()

	now := time.Now().UnixMilli() - Epoch

	if now == g.lastTime {
		g.sequence = (g.sequence + 1) & maxSequence
		if g.sequence == 0 {
			// Sequence exhausted, wait for next millisecond
			for now <= g.lastTime {
				now = time.Now().UnixMilli() - Epoch
			}
		}
	} else {
		g.sequence = 0
	}

	g.lastTime = now

	id := (now << timestampShift) |
		(g.processID << processIDShift) |
		(g.workerID << workerIDShift) |
		g.sequence

	return ID(id)
}

// Timestamp extracts the creation timestamp from a Snowflake ID.
func (id ID) Timestamp() time.Time {
	ms := (int64(id) >> timestampShift) + Epoch
	return time.UnixMilli(ms)
}

// Int64 returns the ID as int64.
func (id ID) Int64() int64 {
	return int64(id)
}

// String returns the ID as a decimal string.
func (id ID) String() string {
	return strconv.FormatInt(int64(id), 10)
}
