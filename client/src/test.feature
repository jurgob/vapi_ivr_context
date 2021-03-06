Feature: Webrtc audio
	Scenario: Single rtc leg establish connection
		Given A conversation "conv_1" with app members:
			| user_a | member_a | socket_a | session_a | track_a |

		When "session_a" POST /coversations/conv_1/rtc and saves response as "rtc1"
		Then "rtc1" http response code is 200
		Then socket "socket_a" receives "rtc:answer" where payload contains
			"""
			{
			body: {
			"rtc_id": "{rtc1.body.rtc_id}"
			},
			"from":"member_a"
			}
			"""
		Then socket "socket_a" receives "rtc:offer" where payload contains
			"""
			{
			body: {
			"rtc_id": "{rtc1.body.rtc_id}"
			},
			"from":"member_a"
			}
			"""

	Scenario: On stream close rtc:hangup is received by all members
		Given A conversation "conv_1" with app members with rtc audio enabled
			| user_a | member_a | socket_a | session_a | track_a | rtc_id_a |
			| user_b | member_b | socket_b | session_b | track_b | rtc_id_b |
			| user_c | member_c | socket_c | session_c | track_c | rtc_id_c |

		When "session_a" DELETE /coversations/{conv_1.response.id}/rtc/{rtc_id_a}
		And "session_a" close peerconnection
		Then socket "socket_a" receives "rtc:hangup" where payload contains
			"""
			{
			"from":"{member_a.id}"
			}
			"""
		Then socket "socket_b" receives "rtc:hangup" where payload contains
			"""
			{
			"from":"{member_a.id}"
			}
			"""
		Then socket "socket_c" receives "rtc:hangup" where payload contains
			"""
			{
			"from":"{member_a.id}"
			}
			"""


	Scenario: user a can send audio to user b
		Given A conversation "conv_1" with app members with rtc audio enabled
			| user_a | member_a | socket_a | session_a | track_a | rtc_id_a |
			| user_b | member_b | socket_b | session_b | track_b | rtc_id_b |
		When "track_a" send audio "hello"
		Then "track_b" receive audio "hello"




	Scenario: user a and user b talk toghether, they receive the correct audio
		Given A conversation "conv_1" with app members with rtc audio enabled
			| user_a | member_a | socket_a | session_a | track_a | rtc_id_a |
			| user_b | member_b | socket_b | session_b | track_b | rtc_id_b |

		When "track_a" send audio "hello from user a" and "track_b" send audio "here user b, hello",
		Then "track_a" receive audio "here user b, hello"