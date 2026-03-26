package auth

import "github.com/valhalla-chat/valhalla/pkg/snowflake"

func testSnowflakeGen() *snowflake.Generator {
	gen, _ := snowflake.NewGenerator(0, 0)
	return gen
}
