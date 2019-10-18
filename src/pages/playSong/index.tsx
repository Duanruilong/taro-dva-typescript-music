import { ComponentClass } from 'react'
import Taro, { Component, Config } from '@tarojs/taro'
import { View, Image, Text, Slider } from '@tarojs/components'
import classnames from 'classnames'
import { connect } from '@tarojs/redux'
import CLyric from '../../components/CLyric'
import CPlayList from '@/containers/CPlayList'
import {timeLengthFormator} from '@/utils'
import './index.scss'

let timer

type PageStateProps = {
  song: PlaySong
}

type PageDispatchProps = {
  getSongInfo: (object) => any,
  updateState: (object) => any,
  getLikeMusicList: (object) => any,
  likeMusic: (object) => any,
  playSingle: (object) => void,
}


type PageState = {
  userInfo: UserInfo,
  isPlaying: boolean,
  lyric: string,
  showLyric: boolean,
  lrc: Lrc,
  lrcIndex: number,
  star: boolean,
  firstEnter: boolean,
  playPercent: number,
  currentyTime: number,
  switchStar: boolean // 是否切换过喜欢状态
  isOpened: boolean
}

const backgroundAudioManager = Taro.getBackgroundAudioManager()

@connect(({
  song
}) => ({
  song: song
}), (dispatch) => ({
  getSongInfo (payload) {
    dispatch({
      type: 'song/getSongInfoAction',
      payload
    })
  },
  getLikeMusicList (payload) {
    dispatch({
      type: 'song/getLikelistAction',
      payload
    })
  },
  likeMusic (payload) {
    dispatch({
      type: 'song/doLikeMusicAction',
      payload
    })
  },
  updateState(payload) {
    dispatch({
      type: 'song/updateState',
      payload
    })
  },
  playSingle (payload) {
    dispatch({
      type: 'song/playSingle',
      payload
    })
  },
}))

class Page extends Component<PageStateProps & PageDispatchProps, PageState> {

  /**
   * 指定config的类型声明为: Taro.Config
   * 由于 typescript 对于 object 类型推导只能推出 Key 的基本类型
   * 对于像 navigationBarTextStyle: 'black' 这样的推导出的类型是 string
   * 提示和声明 navigationBarTextStyle: 'black' | 'white' 类型冲突, 需要显示声明类型
   */
  config: Config = {
    navigationBarTitleText: '加载中...',
    disableScroll: true
  }

  constructor (props) {
    super(props)
    this.state = {
      userInfo: Taro.getStorageSync('userInfo'),
      isPlaying: props.song.isPlaying,
      lyric: '',
      showLyric: false,
      lrc: {
        scroll: false,
        nolyric: false,
        uncollected: false,
        lrclist: []
      },
      lrcIndex: 0,
      star: false,
      firstEnter: true,
      switchStar: false,
      playPercent: 0,
      currentyTime: 0,
      isOpened: false,
    }
  }

  componentWillReceiveProps (nextProps) {
    this.setStar(nextProps.song.likeMusicList, nextProps.song.currentSongInfo.id)
    if (this.props.song.currentSongInfo.name !== nextProps.song.currentSongInfo.name || this.state.firstEnter) {
      this.setState({
        firstEnter: false
      })
      this.setSongInfo(nextProps.song.currentSongInfo)
    }
  }

  setSongInfo(songInfo) {
    try {
      const { name, al, url, lrcInfo } = songInfo
      Taro.setNavigationBarTitle({
        title: name
      })
      backgroundAudioManager.title = name
      backgroundAudioManager.coverImgUrl = al.picUrl
      backgroundAudioManager.src = url
      this.setState({
        lrc: lrcInfo,
        isPlaying: true,
        firstEnter: false
      });
    } catch(err) {
      console.log('err', err)
      this.getNextSong()
    }
  }

  componentWillUnmount () {
    // 更新下播放状态
    this.props.updateState({
      isPlaying: this.state.isPlaying
    })
  }

  componentWillMount() {
    let that = this
    // fix 点击同一首歌重新播放bug
    Taro.getBackgroundAudioPlayerState({
      success(res) {
        if (res.status !== 2) {
          that.setState({
            isPlaying: true,
          })
          timer = setInterval(() =>{
            that.setState({
                currentyTime: backgroundAudioManager.currentTime
              })
              that.updateLrc(backgroundAudioManager.currentTime)
              that.updateProgress(backgroundAudioManager.currentTime)
            }, 300)
        }
      }
    })
    this.getLikeList()
  }

  getLikeList() {
    try {
      const { id } = this.state.userInfo.account
      this.props.getLikeMusicList({
        id
      })
    } catch (err) {
      console.log(err)
    }
  }

  pauseMusic() {
    backgroundAudioManager.pause()
    this.setState({
      isPlaying: false
    })
  }

  playMusic() {
    backgroundAudioManager.play()
    this.setState({
      isPlaying: true
    })
  }

  componentDidMount() {
    const that = this
    const { id } = that.$router.params
    this.props.getSongInfo({
      id
    })

    backgroundAudioManager.onPause(() => {
      this.onPause()
    })
    backgroundAudioManager.onPlay(() => {
      that.setState({
        isPlaying: true
      })
      timer = setInterval(() =>{
        if (!this.state.isPlaying) return
        this.setState({
            currentyTime: backgroundAudioManager.currentTime
          })
          this.updateLrc(backgroundAudioManager.currentTime)
          this.updateProgress(backgroundAudioManager.currentTime)
        }, 300)
      })
    backgroundAudioManager.onEnded(() => {
      const { playMode } = this.props.song
      const routes = Taro.getCurrentPages()
      const currentRoute = routes[routes.length - 1].route
      // 如果在当前页面则直接调用下一首的逻辑，反之则触发nextSong事件
        this.playByMode(playMode)
    })
  }

  onPause() {
    clearInterval(timer)
    this.setState({
      isPlaying: false
    })
  }

  updateLrc(currentPosition) {
    const { lrc } = this.state
    let lrcIndex = 0
    if (lrc && !lrc.scroll && lrc.lrclist && lrc.lrclist.length > 0) {
      lrc.lrclist.forEach((item, index) => {
        if (item.lrc_sec <= currentPosition) {
          lrcIndex = index
        }
      })
    }
    this.setState({
      lrcIndex
    })
  }

  updateProgress(currentPosition) {
    const { dt } = this.props.song.currentSongInfo
    this.setState({
      playPercent: currentPosition * 1000 * 100 / dt
    })
  }

  percentChange(e) {
    this.onPause()
    const { value } = e.detail
    const { dt } = this.props.song.currentSongInfo
    let currentPosition = Math.floor((dt / 1000) * value / 100)
    backgroundAudioManager.seek(currentPosition)
    backgroundAudioManager.play()
  }

  percentChanging() {
    this.onPause()
    backgroundAudioManager.pause()
  }

  // 获取下一首
  getNextSong() {
    const { currentSongIndex, canPlayList, playMode } = this.props.song
    let nextSongIndex = currentSongIndex + 1
    if (playMode === 'shuffle') {
      this.getShuffleSong()
      return
    }
    if (currentSongIndex === canPlayList.length - 1) {
      nextSongIndex = 0
    }
    this.props.getSongInfo({
      id: canPlayList[nextSongIndex].id
    })
  }

  setStar(likeList, id) {
    const { switchStar } = this.state
    const flag: boolean = likeList.indexOf(id) !== -1
    this.setState({
      star: flag
    })
    if (switchStar) {
      this.setState({
        switchStar: false
      })
      Taro.showToast({
        title: flag ? '已添加到我喜欢的音乐' : '已取消喜欢',
        icon: 'none',
        duration: 2000
      })
    }
  }

  // 获取上一首
  getPrevSong() {
    const { currentSongIndex, canPlayList, playMode } = this.props.song
    let prevSongIndex = currentSongIndex - 1
    if (playMode === 'shuffle') {
      this.getShuffleSong()
      return
    }
    if (currentSongIndex === 0) {
      prevSongIndex = canPlayList.length - 1
    }
    this.props.getSongInfo({
      id: canPlayList[prevSongIndex].id
    })
  }

  // 循环播放当前歌曲
  getCurrentSong() {
    const { currentSongInfo } = this.props.song
    this.setSongInfo(currentSongInfo)
  }

  // 随机播放歌曲
  getShuffleSong() {
    const { canPlayList } = this.props.song
    let nextSongIndex = Math.floor(Math.random()*(canPlayList.length - 1))
    this.props.getSongInfo({
      id: canPlayList[nextSongIndex].id
    })
  }

  // 根据播放模式进行播放
  playByMode(playMode: string) {
    switch (playMode) {
      case 'one':
        this.getCurrentSong()
        break
      case 'shuffle':
        this.getShuffleSong()
        break
      // 默认按列表顺序播放
      default:
        this.getNextSong()
    }
  }

  componentDidHide () { }

  showLyric() {
    this.setState({
      showLyric: true
    })
  }

  changePlayMode() {
    let { playMode } = this.props.song
    if (playMode === 'loop') {
      playMode = 'one'
      Taro.showToast({
        title: '单曲循环',
        icon: 'none',
        duration: 2000
      })
    } else if (playMode === 'one') {
      playMode = 'shuffle'
      Taro.showToast({
        title: '随机播放',
        icon: 'none',
        duration: 2000
      })
    } else {
      playMode = 'loop'
      Taro.showToast({
        title: '列表循环',
        icon: 'none',
        duration: 2000
      })
    }
    this.props.updateState({
      playMode
    })
  }

  hiddenLyric() {
    this.setState({
      showLyric: false
    })
  }

  likeMusic() {
    const { star } = this.state
    const { id } = this.props.song.currentSongInfo
    this.props.likeMusic({
      like: !star,
      id
    })
    this.setState({
      switchStar: true
    })
  }

  handleCPlayList() {
    this.setState({
      isOpened: !this.state.isOpened
    })
  }

  doPlaySong(song) {
    const { playSingle, } = this.props
    if (!playSingle) return
    // 没有权限
    if (song.st === -200) {
      Taro.showToast({
        title: '暂无版权',
        icon: 'none'
      })
      return
    }
    playSingle({song})
    const { canPlayList, } = this.props.song
    const currentSongIndex = canPlayList.findIndex(item => item.id === song.id)
    this.props.getSongInfo({
      id: canPlayList[currentSongIndex].id
    })
    this.setState({
      isOpened: false,
    })
  }

  render () {
    const { currentSongInfo, playMode } = this.props.song
    const { isPlaying, showLyric, lrc, lrcIndex, star, playPercent, currentyTime, isOpened } = this.state
    console.log('看一下--playPercent',playPercent,'---currentyTime===>',currentyTime,'---currentSongInfo===...',currentSongInfo);
    
    let playModeImg = require('../../assets/images/song/icn_loop_mode.png')
    if (playMode === 'one') {
      playModeImg = require('../../assets/images/song/icn_one_mode.png')
    } else if (playMode === 'shuffle') {
      playModeImg = require('../../assets/images/song/icn_shuffle_mode.png')
    }
    return (
      <View className='song_container'>
        <Image
          className='song__bg'
          src={currentSongInfo.al.picUrl+'?imageView&thumbnail=368x368'}
        />
        <View className={
          classnames({
            song__music: true,
            hidden: showLyric
          })
        }>
          <View className={
            classnames({
              song__music__main: true,
              playing: isPlaying
            })
          }>
            <Image
            className='song__music__main--before'
            src={require('../../assets/images/aag.png')}
            />
            <View className='song__music__main__cover'>
              <View className={
                classnames({
                  song__music__main__img: true,
                  'z-pause': !isPlaying,
                  circling: true
                })
              }>
                <Image className='song__music__main__img__cover' src={currentSongInfo.al.picUrl+'?imageView&thumbnail=368x368'} />
              </View>
            </View>
          </View>
          <View className='song__music__lgour' onClick={this.showLyric.bind(this)}>
            <View className={
              classnames({
                song__music__lgour__cover: true,
                'z-pause': !isPlaying,
                circling: true
              })
            }>
            </View>
          </View>
        </View>
        {!showLyric&&lrc.lrclist.length>0 && <View className='active-lyric'>{lrc.lrclist[lrcIndex].lrc_text}</View>}
        <View className={
          classnames({
            tools: true,
            hidden: showLyric
          })
        }>
          <Image
              src={star ? require('../../assets/images/song/play_icn_loved.png') : require('../../assets/images/song/play_icn_love.png')}
              className='img'
              onClick={this.likeMusic.bind(this)}
            />
          <View className='icon iconfont icon-icon--'></View>
          <View className='icon iconfont icon-zhuanjiguangpan'></View>
          <View className='icon iconfont icon-pinglun'></View>
          <View className='icon iconfont icon-gengduo'></View>
        </View>
        {/* 时间进度条 */}
        <View className='song__time'>
          <Text className='time-left'>{timeLengthFormator(currentyTime*1000)}</Text>
          <Slider step={0.01} value={playPercent} activeColor='#d43c33' blockColor='#fff' blockSize={24} onChange={this.percentChange.bind(this)} onChanging={this.percentChanging.bind(this)}></Slider>
          <Text className='time-right'>{timeLengthFormator(currentSongInfo.dt)}</Text>
        </View>
        <CLyric lrc={lrc} lrcIndex={lrcIndex} showLyric={showLyric} onTrigger={() => this.hiddenLyric()} />
        <View className='song__bottom'>
          <View className='song__operation'>
            <Image
              src={playModeImg}
              className='song__operation__mode'
              onClick={this.changePlayMode.bind(this)}
            />
            <Image
              src={require('../../assets/images/ajh.png')}
              className='song__operation__prev'
              onClick={this.getPrevSong.bind(this)}
            />
            {
              isPlaying ? <Image src={require('../../assets/images/ajd.png')} className='song__operation__play' onClick={this.pauseMusic.bind(this)}/> :
              <Image src={require('../../assets/images/ajf.png')} className='song__operation__play' onClick={this.playMusic.bind(this)}/>
            }
            <Image
              src={require('../../assets/images/ajb.png')}
              className='song__operation__next'
              onClick={this.getNextSong.bind(this)}
            />
            <View className='icon iconfont icon-chukou' onClick={this.handleCPlayList.bind(this)}></View>
          </View>
        </View>
        <CPlayList isOpened={isOpened} handleClose={this.handleCPlayList.bind(this)} doPlaySong={this.doPlaySong.bind(this)}/>
      </View>
    )
  }
}

export default Page as ComponentClass
