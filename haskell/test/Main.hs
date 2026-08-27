{-# LANGUAGE GADTs #-}

module Main (main) where

import Control.Monad (unless)
import Dsl.Continuation qualified as Continuation
import Dsl.Coyoneda qualified as Coyoneda
import Dsl.Defunctionalization qualified as Defunctionalization
import Dsl.Free qualified as Free
import Dsl.Freer qualified as Freer
import Dsl.Talk (Talk (..), Transcript (..))
import System.Exit (exitFailure)

assertEqual :: (Eq a, Show a) => String -> a -> a -> IO ()
assertEqual label expected actual =
  unless (expected == actual) $ do
    putStrLn (label <> " failed")
    putStrLn ("  expected: " <> show expected)
    putStrLn ("  actual:   " <> show actual)
    exitFailure

main :: IO ()
main = do
  assertEqual "CPS agrees with direct style" Continuation.directExample Continuation.cpsExample
  assertEqual
    "defunctionalization agrees with CPS"
    Continuation.cpsExample
    Defunctionalization.defunctionalizedExample

  let expected = Right (Transcript "Ada" [] ["Hello, Ada!"])
  assertEqual "Free interpreter" expected (Free.runTalk ["Ada"] Free.greet)
  assertEqual "Freer interpreter" expected (Freer.runTalk ["Ada"] Freer.greet)
  assertEqual
    "Free (Coyoneda Talk) is interpreted as Freer Talk"
    expected
    ( Freer.runTalk
        ["Ada"]
        (Coyoneda.freeCoyonedaToFreer (Coyoneda.freerToFreeCoyoneda Freer.greet))
    )

  case Freer.view Freer.greet of
    Freer.Done _ -> failTest "greet unexpectedly completed before Ask"
    Freer.Await (Tell _) _ -> failTest "greet yielded Tell before Ask"
    Freer.Await (Ask question) afterAsk -> do
      assertEqual "first request" "Your name?" question
      case Freer.view (afterAsk "Ada") of
        Freer.Done _ -> failTest "greet unexpectedly completed before Tell"
        Freer.Await (Ask _) _ -> failTest "greet yielded a second Ask"
        Freer.Await (Tell message) afterTell -> do
          assertEqual "second request" "Hello, Ada!" message
          case Freer.view (afterTell ()) of
            Freer.Done value -> assertEqual "final value" "Ada" value
            Freer.Await _ _ -> failTest "greet did not complete after Tell"

  assertEqual
    "input exhaustion"
    (Left "Talk interpreter has no more input")
    (Freer.runTalk [] Freer.greet)

  putStrLn "All Haskell theory tests passed"

failTest :: String -> IO ()
failTest message = do
  putStrLn message
  exitFailure
